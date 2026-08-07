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
    get_previous_limit_up,
)
from app.data.calendar import get_latest_trade_date as _cal_date  # noqa: E402
from app.ml.scoring import score_limit_up_batch, FIVE_DIM_WEIGHTS  # noqa: E402
from app.ml.strategy_pool import get_pool, WEIGHT_KEYS, get_active_gene  # noqa: E402
from app.ml.world_model import (  # noqa: E402
    get_world,
    get_world_env,
    apply_env_weights,
    classify_environment,
    _compute_env_signals,
    ENV_WEIGHT_ADJUSTMENTS,
)
from app.ml.health import (  # noqa: E402
    record_verification,
    record_evolve,
    record_anomaly,
    get_model_health,
    get_evolution_health,
)

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

    # 判断 ranking.json 是否可作为 T-1 预测：
    # 其 trade_date 必须等于 prev_date（T-1）。若等于 trade_date（T）说明是今天的快照，
    # 不能当 T-1 预测用（今天涨停股 ≠ 昨天涨停股），需现场用 prev_date 数据重新评分。
    ranking_date = ranking_data.get("trade_date") if ranking_data else None
    use_ranking = ranking_data is not None and ranking_date == prev_date

    if use_ranking:
        predictions = ranking_data.get("ranking", [])
        environment = ranking_data.get("environment", "未知")
        # ranking.json 已含 gene_params，提取以便样本记录（用于审计复现）
        ranking_gene_params = ranking_data.get("gene_params")
    else:
        # ranking.json 不可用或日期不匹配（多半是今天的快照）→ 现场用 T-1 数据重新评分
        if ranking_date:
            print(f"[verify] ranking.json trade_date={ranking_date} ≠ T-1({prev_date})，现场用 {prev_date} 重新评分...")
        else:
            print(f"[verify] ranking.json 不存在，现场用 {prev_date} 评分...")
        records = get_limit_up_data(prev_date)
        if not records:
            print(f"[verify] {prev_date} 无涨停数据，跳过")
            return _empty_verify_result(prev_date, trade_date)
        # 计算 theme_stats（样本需携带，供策略池用各自基因重新打分）
        recompute_theme_stats = {}
        for r in records:
            for c in r.get("concepts", []):
                recompute_theme_stats[c] = recompute_theme_stats.get(c, 0) + 1
        snap = get_market_snapshot(prev_date)
        world_env = get_world_env(records, snap)
        # 用当前主策略权重 + 基因 + 环境微调 重新评分（与 make_snapshot 一致）
        active_gene = get_active_gene()
        final_weights = apply_env_weights(
            get_pool().get_active_weights(), world_env["environment"]
        )
        scored = score_limit_up_batch(records, recompute_theme_stats, final_weights, active_gene)
        predictions = scored
        environment = world_env["environment"]
        ranking_gene_params = scored[0].get("gene_params") if scored else None

    if not predictions:
        print(f"[verify] {prev_date} 无预测数据，跳过")
        return _empty_verify_result(prev_date, trade_date)

    print(f"[verify] 预测日: {prev_date}  实际日: {trade_date}  预测数: {len(predictions)}  环境: {environment}")

    # 获取 T 日实际表现（作为标签来源）
    # 主源：get_previous_limit_up(T) —— 昨日涨停股今日表现（含涨跌幅/开盘涨幅，多目标 label）
    # 次源：get_limit_up_data(T) —— T 日涨停池（用于判断连板）
    # 关键：拉不到任何真实数据 → 跳过该日，绝不 Bernoulli 自证
    prev_perf_map: dict[str, dict] = {}  # code -> {today_pct_chg, today_open_pct}
    actual_limit_ups: set[str] = set()
    label_source = "none"

    # 方法1：昨日涨停今日表现（最准确的多目标 label 源）
    try:
        prev_results = get_previous_limit_up(trade_date)
        if prev_results:
            for r in prev_results:
                code = r.get("code", "")
                prev_perf_map[code] = {
                    "today_pct_chg": float(r.get("today_pct_chg", 0)),
                    "today_open_pct": float(r.get("today_open_pct", 0)),
                }
            label_source = "akshare_previous"
            print(f"[verify] 昨日涨停今日表现: {len(prev_perf_map)} 只 (label 源: {label_source})")
    except Exception as e:
        print(f"[verify] 获取昨日涨停今日表现失败: {e}")

    # 方法2：T 日涨停池（补充连板判断）
    try:
        actual_records = get_limit_up_data(trade_date)
        actual_limit_ups = {r.get("code", "") for r in actual_records}
        if actual_limit_ups:
            print(f"[verify] T日涨停池: {len(actual_limit_ups)} 只")
            if label_source == "none":
                label_source = "akshare_ztpool"
    except Exception as e:
        print(f"[verify] 获取 T日涨停池失败: {e}")

    # 关键：无任何真实数据 → 跳过该日，绝不 Bernoulli 自证（旧逻辑的自证 bug 在此根除）
    if not prev_perf_map and not actual_limit_ups:
        print(f"[verify] ⚠ {trade_date} 无任何真实表现数据，跳过验证（绝不自证）")
        result = _empty_verify_result(prev_date, trade_date)
        result["label_source"] = "none"
        result["skip_reason"] = "no_real_data"
        return result

    # 构造训练样本 + 计算命中率
    new_samples: list[dict] = []
    hit_count = 0
    verified_count = 0

    # 从 predictions 构建 theme_stats（供策略池用各自基因重新打分 _score_theme_freshness）
    # 当 use_ranking=True 时无原始 records，从 predictions 的 concepts 统计
    sample_theme_stats: dict[str, int] = {}
    for pred in predictions:
        for c in pred.get("concepts", []):
            sample_theme_stats[c] = sample_theme_stats.get(c, 0) + 1

    for pred in predictions:
        code = pred.get("code", "")
        sub_scores = pred.get("sub_scores", {})
        total_score = pred.get("total_score", 50.0)
        predicted_prob = _score_to_prob(total_score)

        # 多目标 label
        perf = prev_perf_map.get(code, {})
        today_pct = perf.get("today_pct_chg")  # 可能为 None
        today_open_pct = perf.get("today_open_pct")

        # is_limit_up_next: 次日继续涨停/连板（出现在 T 日涨停池 或 涨幅≥9.5）
        is_limit_up_next = (code in actual_limit_ups) or (
            today_pct is not None and today_pct >= 9.5
        )
        # is_up_next: 次日上涨
        is_up_next = today_pct is not None and today_pct > 0
        # next_pct: 次日涨跌幅（回归用）
        next_pct = round(today_pct, 2) if today_pct is not None else None
        # is_open_up: 次日红盘开盘（接力强度信号）
        is_open_up = today_open_pct is not None and today_open_pct > 0

        # 该票既无 prev_perf 也不在涨停池 → 无法验证，跳过
        if today_pct is None and code not in actual_limit_ups:
            continue

        # 顶层 label 用 is_up_next（样本更均衡；涨停率~20%会导致 brier 失真）
        label = is_up_next

        verified_count += 1
        if label:
            hit_count += 1

        # 保存原始 rec 字段（供策略池用各自基因重新打分）
        # 包含 _score_board_strength/_score_seal_quality/_score_theme_freshness/_score_volume_health 所需的全部字段
        rec = {
            "code": code,
            "name": pred.get("name", ""),
            "boards": int(pred.get("boards", 1)),
            "seal_amount": float(pred.get("seal_amount", 0)),
            "float_mv": float(pred.get("float_mv", 50)),
            "seal_time": str(pred.get("seal_time", "10:00")),
            "break_times": int(pred.get("break_times", 0)),
            "concepts": pred.get("concepts", []),
            "turnover": float(pred.get("turnover", 5)),
            "amount": float(pred.get("amount", 0)),
            "limit_type": str(pred.get("limit_type", "换手板")),
            "industry": pred.get("industry", ""),
        }

        new_samples.append({
            "date": prev_date,
            "code": code,
            "name": pred.get("name", ""),
            "rec": rec,  # 原始字段，供策略池用各自基因重新打分
            "theme_stats": sample_theme_stats,  # 共享的题材统计
            "sub_scores": sub_scores,
            "total_score": total_score,
            "predicted_prob": predicted_prob,
            "gene_params": ranking_gene_params,  # 评分时使用的基因（审计用）
            "abs_grade": pred.get("abs_grade", ""),
            "rel_grade": pred.get("rel_grade", ""),
            "label": label,  # 顶层 bool（= is_up_next），向后兼容现有 strategy_pool/health 逻辑
            "labels": {  # 多目标，供阶段3 多目标 fitness 使用
                "is_limit_up_next": is_limit_up_next,
                "is_up_next": is_up_next,
                "next_pct": next_pct,
                "is_open_up": is_open_up,
            },
            "environment": environment,
        })

    accuracy = hit_count / verified_count if verified_count > 0 else 0.0
    brier = _compute_brier(new_samples)

    print(f"[verify] 验证完成: {verified_count} 只, 命中 {hit_count}, 准确率 {accuracy:.1%}, Brier {brier:.4f}")
    print(f"[verify] label 源: {label_source}")

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
        "label_source": label_source,
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
        "label_source": "none",
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
        "label_source": verify_result.get("label_source", "none"),
        "event": "prediction_verification",
        "level": "info" if verify_result["accuracy"] >= 0.3 else "warning",
        "summary": f"{verified_date} 预测验证: {verify_result['verified']}只, 命中{verify_result['hit_count']}, 准确率{verify_result['accuracy']:.1%} (源:{verify_result.get('label_source','none')})",
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

    # 记录进化（传入策略池进化摘要，含多目标指标 + 基因）
    record_evolve(result["best_version"], len(all_samples), evolution_summary=result)

    return result


def update_world_model(verify_result: dict) -> dict[str, Any]:
    """更新世界模型：记录本次环境下的命中率，自适应调整权重微调系数。

    思路：某环境准确率低 → 逆转该环境的权重偏好（放大的降、抑制的升）；
          准确率高 → 微幅强化当前方向。调整持久化到 world_model.json。
    """
    wm = get_world()
    environment = verify_result.get("environment", "正常偏强")
    accuracy = verify_result.get("accuracy", 0.0)
    brier = verify_result.get("brier", 0.0)
    sample_count = verify_result.get("verified", 0)

    # 记录本次验证
    wm.record(environment, accuracy, brier, sample_count)

    # 检查各环境命中率
    env_accuracy = wm.accuracy_in(environment)
    print(f"[world] 环境 [{environment}] 历史准确率: {env_accuracy} (本次 {accuracy:.1%})")

    # 自适应调权（用历史累计准确率，更稳健）
    adjustments: dict[str, Any] = {}
    if env_accuracy is not None:
        adapt_result = wm.adapt_weights(environment, env_accuracy, sample_count)
        if adapt_result.get("changed"):
            adjustments[environment] = {
                "old": adapt_result["old"],
                "new": adapt_result["new"],
                "accuracy": adapt_result["accuracy"],
            }
            print(f"[world] ✓ 环境 [{environment}] 自适应调权:")
            for k in adapt_result["old"]:
                old_v = adapt_result["old"][k]
                new_v = adapt_result["new"][k]
                if old_v != new_v:
                    print(f"    {k}: {old_v} → {new_v}")

    # 保存世界模型状态（含 adaptive_adjustments）
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
            "active_gene": pool_summary.get("active_gene", {}),
            "pool_size": len(pool_summary.get("pool", [])),
            "strategies": [
                {
                    "style": s["style"],
                    "fitness": s["fitness"],
                    "accuracy": s["accuracy"],
                    "acc_limit": s.get("acc_limit", 0.0),
                    "acc_open": s.get("acc_open", 0.0),
                    "rank_corr": s.get("rank_corr", 0.0),
                    "brier": s["brier"],
                    "samples_tested": s.get("samples_tested", 0),
                    "gene_params": s.get("gene_params", {}),
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

    # 进化已改变策略池/世界模型/health 状态，刷新健康快照，使线上前端面板
    # （策略池表格、最近一代进化、进化趋势）反映最新一代的多目标指标 + 基因。
    # CI 中 make_snapshot 先于 auto_evolve 运行，若不在此刷新，health_* 会滞后一代。
    try:
        _write_json(os.path.join(SNAP_DIR, "health_pool.json"), pool.summary())
        _write_json(os.path.join(SNAP_DIR, "health_model.json"), get_model_health())
        _write_json(os.path.join(SNAP_DIR, "health_evolution.json"), get_evolution_health())
        print(f"[output] health_pool/health_model/health_evolution.json 已刷新（反映最新一代进化）")
    except Exception as e:
        print(f"[output] ⚠ 健康快照刷新失败（非致命）: {e}")

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
