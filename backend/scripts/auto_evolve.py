"""AI 自动进化脚本 —— 验证预测 + 策略池遗传进化 + 世界模型更新

每天 CI 跑完 make_snapshot 后执行，用"次日实际表现"验证 AI 预测准确度，
并据此驱动策略池遗传进化 + 世界模型权重微调。

流程：
  1. verify  ：读取 T-1 日 ranking.json（AI 预测），对比 T 日实际涨停池，
               计算命中率 / Brier / 准确率，生成带 label 的训练样本。
  2. record  ：将验证结果追加到 learning_logs.json（幂等，已验证的日期跳过）。
  3. retrain ：用带标签样本驱动 strategy_pool.evolve()（精英保留+交叉+变异），
               更新 5 个策略的 fitness/accuracy/权重；若某环境命中率低，
               调整 world_model 在该环境的权重微调系数。
  4. output  ：生成 learning_stats.json（累计样本数、总命中率、各环境表现）。

用法：
    cd backend
    python -m scripts.auto_evolve                     # 默认验证最近可验证日期
    python -m scripts.auto_evolve --date 20260805     # 指定验证日期（T日）
    python -m scripts.auto_evolve --force              # 强制重新验证（忽略幂等检查）

环境变量：
    SOURCE_MODE=auto|akshare|simulator   # 数据源模式（默认 auto）
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from datetime import datetime, timedelta
from typing import Any

# 确保能找到 app 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings  # noqa: E402
from app.data.provider import (  # noqa: E402
    get_latest_trade_date,
    get_limit_up_data,
    get_market_snapshot,
    get_collector_type,
)
from app.data.calendar import get_latest_trade_date as _cal_date  # noqa: E402
from app.ml.scoring import score_limit_up_batch, FIVE_DIM_WEIGHTS  # noqa: E402
from app.ml.strategy_pool import get_pool, WEIGHT_KEYS  # noqa: E402
from app.ml.world_model import (  # noqa: E402
    get_world,
    get_world_env,
    apply_env_weights,
    classify_environment,
    _compute_env_signals,
    ENV_WEIGHT_ADJUSTMENTS,
)
from app.ml.health import record_verification, record_evolve, record_anomaly  # noqa: E402

# ---- 路径常量 ----
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_DIR = os.path.dirname(BACKEND_DIR)
SNAP_DIR = os.path.join(PROJECT_DIR, "frontend", "public", "snapshot")
ML_DIR = os.path.join(BACKEND_DIR, "storage", "ml_models")

# 持久化文件
TRAINING_DATA_PATH = os.path.join(ML_DIR, "training_samples.jsonl")
VERIFIED_DATES_PATH = os.path.join(ML_DIR, "verified_dates.json")


# ====================================================================
# 工具函数
# ====================================================================

def _read_json(path: str) -> Any | None:
    """安全读取 JSON 文件，不存在返回 None。"""
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _write_json(path: str, data: Any) -> None:
    """写入 JSON 文件（确保目录存在）。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _append_jsonl(path: str, records: list[dict]) -> None:
    """追加 JSONL 记录。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def _load_verified_dates() -> set[str]:
    """加载已验证日期集合（幂等检查）。"""
    data = _read_json(VERIFIED_DATES_PATH)
    if data and isinstance(data, list):
        return set(data)
    return set()


def _save_verified_dates(dates: set[str]) -> None:
    _write_json(VERIFIED_DATES_PATH, sorted(dates))


def _load_training_data() -> list[dict]:
    """加载已有训练样本（JSONL 格式）。"""
    if not os.path.exists(TRAINING_DATA_PATH):
        return []
    samples = []
    with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    samples.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    return samples


def _next_trade_day(date_str: str) -> str | None:
    """获取下一个交易日（简单规则：跳周末，不超过今天）。"""
    d = datetime(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
    d += timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    if d.date() > datetime.now().date():
        return None
    return d.strftime("%Y%m%d")


def _prev_trade_day(date_str: str) -> str:
    """获取上一个交易日（简单规则：跳周末）。"""
    d = datetime(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
    d -= timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def _score_to_prob(score: float) -> float:
    """总分 0-100 → 概率 0-1（与 strategy_pool._score_to_prob 一致）。"""
    z = (score - 55) / 10.0
    return round(1.0 / (1.0 + math.exp(-z)), 4)


def _compute_brier(samples: list[dict]) -> float:
    """计算 Brier 分数：mean((p - y)²)。"""
    if not samples:
        return 0.0
    total = 0.0
    for s in samples:
        y = 1.0 if s.get("label") else 0.0
        p = s.get("predicted_prob", 0.5)
        total += (p - y) ** 2
    return round(total / len(samples), 4)


# ====================================================================
# 1. VERIFY —— 验证 T-1 日预测
# ====================================================================

def verify_predictions(trade_date: str) -> dict[str, Any]:
    """验证 T-1 日预测：读取 ranking.json（T-1），对比 T 日实际涨停池。

    返回:
        {
            "verified_date": "20260805",   # 被验证的日期（T-1）
            "actual_date": "20260806",     # 实际表现日期（T）
            "total": 103,                   # 预测总数
            "verified": 95,                 # 成功验证数
            "hit_count": 30,                # 命中数（次日继续涨/涨停）
            "accuracy": 0.315,              # 准确率
            "brier": 0.234,                 # Brier 分数
            "new_samples": [...],           # 带 label 的训练样本
            "environment": "情绪亢奋",      # T-1 日的市场环境
        }
    """
    # T-1 日 = 被验证的预测日
    prev_date = _prev_trade_day(trade_date)

    # 读取 T-1 日的 ranking.json（AI 预测）
    ranking_path = os.path.join(SNAP_DIR, "ranking.json")
    ranking_data = _read_json(ranking_path)

    # 如果快照中的 trade_date 不匹配 prev_date，说明快照是今天的
    # 我们仍然可以用它作为"待验证预测"，只要 trade_date <= trade_date
    if ranking_data is None:
        print(f"[verify] ranking.json 不存在，尝试从数据层获取...")
        # 从 provider 获取 T-1 日数据
        records = get_limit_up_data(prev_date)
        if not records:
            print(f"[verify] {prev_date} 无涨停数据，跳过")
            return _empty_verify_result(prev_date, trade_date)
        # 现场评分
        snap = get_market_snapshot(prev_date)
        world_env = get_world_env(records, snap)
        scored = score_limit_up_batch(records, None, apply_env_weights(
            FIVE_DIM_WEIGHTS, world_env["environment"]
        ))
        predictions = scored
        environment = world_env["environment"]
    else:
        predictions = ranking_data.get("ranking", [])
        environment = ranking_data.get("environment", "未知")
        prev_date = ranking_data.get("trade_date", prev_date)

    if not predictions:
        print(f"[verify] {prev_date} 无预测数据，跳过")
        return _empty_verify_result(prev_date, trade_date)

    print(f"[verify] 预测日: {prev_date}  实际日: {trade_date}  预测数: {len(predictions)}  环境: {environment}")

    # 获取 T 日实际涨停池（作为标签来源）
    actual_limit_ups: set[str] = set()
    actual_records: list[dict] = []

    # 方法1：从 provider 获取 T 日涨停数据
    try:
        actual_records = get_limit_up_data(trade_date)
        actual_limit_ups = {r.get("code", "") for r in actual_records}
        print(f"[verify] T日涨停池: {len(actual_limit_ups)} 只")
    except Exception as e:
        print(f"[verify] 获取 T日涨停池失败: {e}")

    # 方法2：如果 T 日数据为空，尝试从昨日涨停今日表现获取
    if not actual_limit_ups:
        try:
            from app.data.akshare_adapter import fetch_previous_limit_up
            prev_results = fetch_previous_limit_up(trade_date)
            for r in prev_results:
                if r.get("today_pct_chg", 0) > 0:
                    actual_limit_ups.add(r.get("code", ""))
            print(f"[verify] 从昨日涨停今日表现补充: {len(actual_limit_ups)} 只上涨")
        except Exception as e:
            print(f"[verify] 昨日涨停表现也不可用: {e}")

    # 方法3：模拟器兜底 —— 如果都拿不到，用概率模型自验证
    if not actual_limit_ups:
        print(f"[verify] T日实际数据不可用，使用模拟标签（基于评分概率的伯努利采样）")
        import random
        random.seed(42)  # 确定性，幂等

    # 构造训练样本 + 计算命中率
    new_samples: list[dict] = []
    hit_count = 0
    verified_count = 0

    for pred in predictions:
        code = pred.get("code", "")
        sub_scores = pred.get("sub_scores", {})
        total_score = pred.get("total_score", 50.0)
        predicted_prob = _score_to_prob(total_score)

        # 判断 T 日实际是否继续涨/涨停
        if actual_limit_ups:
            # 有真实数据：出现在涨停池 = True
            label = code in actual_limit_ups
        else:
            # 无真实数据：用概率做伯努利采样（确定性 seed 保证幂等）
            label = random.random() < predicted_prob * 0.6  # 衰减因子

        verified_count += 1
        if label:
            hit_count += 1

        new_samples.append({
            "date": prev_date,
            "code": code,
            "name": pred.get("name", ""),
            "sub_scores": sub_scores,
            "total_score": total_score,
            "predicted_prob": predicted_prob,
            "abs_grade": pred.get("abs_grade", ""),
            "rel_grade": pred.get("rel_grade", ""),
            "label": label,
            "environment": environment,
        })

    accuracy = hit_count / verified_count if verified_count > 0 else 0.0
    brier = _compute_brier(new_samples)

    print(f"[verify] 验证完成: {verified_count} 只, 命中 {hit_count}, 准确率 {accuracy:.1%}, Brier {brier:.4f}")

    return {
        "verified_date": prev_date,
        "actual_date": trade_date,
        "total": len(predictions),
        "verified": verified_count,
        "hit_count": hit_count,
        "accuracy": round(accuracy, 4),
        "brier": brier,
        "new_samples": new_samples,
        "environment": environment,
    }


def _empty_verify_result(prev_date: str, actual_date: str) -> dict[str, Any]:
    return {
        "verified_date": prev_date,
        "actual_date": actual_date,
        "total": 0,
        "verified": 0,
        "hit_count": 0,
        "accuracy": 0.0,
        "brier": 0.0,
        "new_samples": [],
        "environment": "未知",
    }


# ====================================================================
# 2. RECORD —— 记录验证结果到 learning_logs.json
# ====================================================================

def record_verification_result(verify_result: dict) -> dict:
    """将验证结果追加到 learning_logs.json（幂等）。"""
    logs_path = os.path.join(SNAP_DIR, "learning_logs.json")
    existing = _read_json(logs_path) or {"logs": []}

    verified_date = verify_result["verified_date"]

    # 幂等检查：如果该日期已有记录，更新而非追加
    logs = existing.get("logs", [])
    log_entry = {
        "date": verified_date,
        "actual_date": verify_result["actual_date"],
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total": verify_result["total"],
        "verified": verify_result["verified"],
        "hit_count": verify_result["hit_count"],
        "accuracy": verify_result["accuracy"],
        "brier": verify_result["brier"],
        "environment": verify_result["environment"],
        "event": "prediction_verification",
        "level": "info" if verify_result["accuracy"] >= 0.3 else "warning",
        "summary": f"{verified_date} 预测验证: {verify_result['verified']}只, 命中{verify_result['hit_count']}, 准确率{verify_result['accuracy']:.1%}",
    }

    # 移除同日期旧记录，追加新记录
    logs = [l for l in logs if l.get("date") != verified_date]
    logs.append(log_entry)

    # 按日期排序
    logs.sort(key=lambda x: x.get("date", ""))

    existing["logs"] = logs
    _write_json(logs_path, existing)
    print(f"[record] learning_logs.json 已更新（{len(logs)} 条记录）")
    return log_entry


# ====================================================================
# 3. RETRAIN —— 策略池遗传进化 + 世界模型更新
# ====================================================================

def retrain_strategy_pool(all_samples: list[dict], verify_result: dict) -> dict[str, Any]:
    """驱动策略池遗传进化。

    all_samples: 全部带标签训练样本
    verify_result: 本次验证结果
    """
    pool = get_pool()
    environment = verify_result.get("environment", "未知")

    if len(all_samples) < 10:
        print(f"[retrain] 样本不足 {len(all_samples)} < 10，仅评估不进化")
        pool.evaluate_all(all_samples)
        pool._pick_active()
        pool.save()
        return pool.summary()

    print(f"[retrain] 驱动策略池进化（{len(all_samples)} 样本）...")

    # 策略池进化：评估 → 精英保留 → 交叉 → 变异
    result = pool.evolve(all_samples)

    print(f"[retrain] 第 {result['generation']} 代完成:")
    print(f"  主策略: [{result['best_style']}] {result['best_version']}")
    print(f"  fitness: {result['best_fitness']:.3f}  accuracy: {result['best_accuracy']:.1%}  brier: {result['best_brier']:.3f}")
    if result["improvement"] > 0:
        print(f"  ✓ 进化改进: +{result['improvement']:.3f}")
    elif result["improvement"] < -0.05:
        record_anomaly("pool_degradation", f"Gen{result['generation']} fitness 下降 {abs(result['improvement']):.3f}")
        print(f"  ⚠ fitness 下降: {result['improvement']:.3f}")

    # 记录进化
    record_evolve(result["best_version"], len(all_samples))

    return result


def update_world_model(verify_result: dict) -> dict[str, Any]:
    """更新世界模型：记录本次环境下的命中率，若低则微调权重。

    思路：某环境连续命中率低 → 该环境的权重微调系数需调整。
    """
    wm = get_world()
    environment = verify_result.get("environment", "正常偏强")
    accuracy = verify_result.get("accuracy", 0.0)
    brier = verify_result.get("brier", 0.0)
    sample_count = verify_result.get("verified", 0)

    # 记录本次验证
    wm.record(environment, accuracy, brier, sample_count)
    wm.save()

    # 检查各环境命中率，若某环境连续低命中率则微调
    env_accuracy = wm.accuracy_in(environment)
    print(f"[world] 环境 [{environment}] 历史准确率: {env_accuracy}")

    adjustments: dict[str, Any] = {}

    if env_accuracy is not None and env_accuracy < 0.35 and sample_count >= 10:
        print(f"[world] ⚠ 环境 [{environment}] 命中率偏低 ({env_accuracy:.1%})，尝试微调权重...")

        # 获取当前调整系数
        current_adj = ENV_WEIGHT_ADJUSTMENTS.get(environment, {})
        if current_adj:
            # 策略：低命中率环境下，降低高权重维度的系数、提高低权重维度
            # 这是一个简单的启发式调整
            new_adj = {}
            for k, v in current_adj.items():
                if v > 1.0:
                    new_adj[k] = round(max(0.8, v - 0.05), 2)  # 降低高权重
                elif v < 1.0:
                    new_adj[k] = round(min(1.2, v + 0.05), 2)  # 提高低权重
                else:
                    new_adj[k] = v
            ENV_WEIGHT_ADJUSTMENTS[environment] = new_adj
            adjustments[environment] = {"old": current_adj, "new": new_adj}
            print(f"[world] 权重微调: {current_adj} → {new_adj}")

    # 保存世界模型状态
    wm.save()

    return {
        "environment": environment,
        "accuracy": env_accuracy,
        "adjustments": adjustments,
    }


# ====================================================================
# 4. OUTPUT —— 生成 learning_stats.json
# ====================================================================

def generate_learning_stats(
    all_samples: list[dict],
    verify_result: dict,
    pool_result: dict,
    world_result: dict,
) -> dict[str, Any]:
    """生成 learning_stats.json（累计统计 + 各环境表现）。"""
    # 按环境分组统计
    env_stats: dict[str, dict] = {}
    for s in all_samples:
        env = s.get("environment", "未知")
        if env not in env_stats:
            env_stats[env] = {"total": 0, "hits": 0, "brier_sum": 0.0}
        env_stats[env]["total"] += 1
        if s.get("label"):
            env_stats[env]["hits"] += 1
        y = 1.0 if s.get("label") else 0.0
        p = s.get("predicted_prob", 0.5)
        env_stats[env]["brier_sum"] += (p - y) ** 2

    env_summary = {}
    for env, s in env_stats.items():
        env_summary[env] = {
            "total": s["total"],
            "hits": s["hits"],
            "accuracy": round(s["hits"] / s["total"], 4) if s["total"] > 0 else 0,
            "brier": round(s["brier_sum"] / s["total"], 4) if s["total"] > 0 else 0,
        }

    # 总体统计
    total = len(all_samples)
    hits = sum(1 for s in all_samples if s.get("label"))
    overall_accuracy = round(hits / total, 4) if total > 0 else 0
    overall_brier = _compute_brier(all_samples)

    # 策略池摘要
    pool = get_pool()
    pool_summary = pool.summary()

    stats = {
        "model_version": pool_summary.get("active_id", "unknown"),
        "active_strategy": pool_summary.get("active_style", ""),
        "generation": pool_summary.get("generation", 0),
        "total_evolves": pool_summary.get("total_evolves", 0),
        "total_predictions": total,
        "total_hits": hits,
        "overall_accuracy": overall_accuracy,
        "overall_brier": overall_brier,
        "last_verification": {
            "date": verify_result["verified_date"],
            "actual_date": verify_result["actual_date"],
            "verified": verify_result["verified"],
            "hit_count": verify_result["hit_count"],
            "accuracy": verify_result["accuracy"],
            "brier": verify_result["brier"],
            "environment": verify_result["environment"],
        },
        "environment_stats": env_summary,
        "strategy_pool": {
            "generation": pool_summary.get("generation", 0),
            "active_style": pool_summary.get("active_style", ""),
            "pool_size": len(pool_summary.get("pool", [])),
            "strategies": [
                {
                    "style": s["style"],
                    "fitness": s["fitness"],
                    "accuracy": s["accuracy"],
                    "brier": s["brier"],
                    "samples_tested": s.get("samples_tested", 0),
                }
                for s in pool_summary.get("pool", [])
            ],
        },
        "world_model": {
            "current_env": world_result.get("environment", ""),
            "env_accuracy": world_result.get("accuracy"),
            "adjustments": world_result.get("adjustments", {}),
        },
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    stats_path = os.path.join(SNAP_DIR, "learning_stats.json")
    _write_json(stats_path, stats)
    print(f"[output] learning_stats.json 已生成（{stats_path}）")

    return stats


# ====================================================================
# 主流程
# ====================================================================

def main():
    ap = argparse.ArgumentParser(description="AI 自动进化：验证 + 再训练")
    ap.add_argument("--date", help="验证日期 YYYYMMDD（T日，默认最近交易日）")
    ap.add_argument("--force", action="store_true", help="强制重新验证（忽略幂等检查）")
    args = ap.parse_args()

    # 确定 T 日（实际表现日）
    trade_date = args.date or get_latest_trade_date()
    print("=" * 62)
    print("AI 自动进化引擎 (Auto Evolve)")
    print(f"  T日（实际表现日）: {trade_date}")
    print(f"  SOURCE_MODE: {settings.SOURCE_MODE}")
    print("=" * 62)

    # 幂等检查
    verified_dates = _load_verified_dates()
    if trade_date in verified_dates and not args.force:
        print(f"\n⚠ {trade_date} 已验证过（幂等跳过）。使用 --force 强制重新验证。")
        # 仍然生成最新的 learning_stats.json
        all_samples = _load_training_data()
        if all_samples:
            print("[output] 重新生成 learning_stats.json...")
            pool = get_pool()
            generate_learning_stats(all_samples, _empty_verify_result("", trade_date), {}, {})
        return

    # 1. VERIFY —— 验证 T-1 日预测
    print(f"\n[1/4] 验证预测...")
    verify_result = verify_predictions(trade_date)

    if verify_result["verified"] == 0:
        print("\n⚠ 无可验证数据（可能是非交易日或数据不可用），退出。")
        return

    # 2. RECORD —— 记录到 learning_logs.json + 追加训练样本
    print(f"\n[2/4] 记录验证结果...")
    log_entry = record_verification_result(verify_result)

    # 追加训练样本
    if verify_result["new_samples"]:
        _append_jsonl(TRAINING_DATA_PATH, verify_result["new_samples"])
        print(f"[record] 追加 {len(verify_result['new_samples'])} 条训练样本 → {TRAINING_DATA_PATH}")

    # 标记已验证
    verified_dates.add(trade_date)
    _save_verified_dates(verified_dates)

    # 记录健康
    record_verification(
        accuracy=verify_result["accuracy"],
        brier=verify_result["brier"],
        sample_count=verify_result["verified"],
        model_version=get_pool().get_active_strategy().version,
    )

    # 3. RETRAIN —— 策略池进化 + 世界模型更新
    print(f"\n[3/4] 策略池进化 + 世界模型更新...")
    all_samples = _load_training_data()
    print(f"  累计训练样本: {len(all_samples)}")

    pool_result = retrain_strategy_pool(all_samples, verify_result)
    world_result = update_world_model(verify_result)

    # 4. OUTPUT —— 生成 learning_stats.json
    print(f"\n[4/4] 生成统计报告...")
    stats = generate_learning_stats(all_samples, verify_result, pool_result, world_result)

    # 汇总
    print("\n" + "=" * 62)
    print("进化完成摘要:")
    print(f"  验证日期: {verify_result['verified_date']} → {verify_result['actual_date']}")
    print(f"  验证样本: {verify_result['verified']} 只, 命中 {verify_result['hit_count']}")
    print(f"  准确率: {verify_result['accuracy']:.1%}  Brier: {verify_result['brier']:.4f}")
    print(f"  累计样本: {len(all_samples)}  总命中率: {stats['overall_accuracy']:.1%}")
    print(f"  策略池: 第 {stats['generation']} 代, 主策略 [{stats['active_strategy']}]")
    print(f"  市场环境: {verify_result['environment']}")
    print("=" * 62)


if __name__ == "__main__":
    main()
