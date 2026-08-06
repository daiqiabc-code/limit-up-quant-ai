"""静态快照生成器 —— 直接调用数据层，无需启动后端 HTTP 服务。

用法：
    cd backend && python -m scripts.make_snapshot

环境变量：
    SOURCE_MODE=akshare    # 强制使用真实行情（失败返回空，不降级）
    SOURCE_MODE=simulator   # 强制使用模拟器
    SOURCE_MODE=auto        # 优先真实，失败降级模拟器（默认）

输出：
    frontend/public/snapshot/limitup.json
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime

# 确保能找到 app 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---- 读取 SOURCE_MODE 环境变量，在导入 app 之前生效 ----
_source_mode = os.environ.get("SOURCE_MODE", "auto")
os.environ.setdefault("SOURCE_MODE", _source_mode)

from app.config import settings  # noqa: E402
# 运行时覆盖配置（环境变量优先级高于 .env）
settings.SOURCE_MODE = _source_mode  # type: ignore

from app.data.provider import (  # noqa: E402
    get_latest_trade_date,
    get_limit_up_data,
    get_previous_limit_up,
    get_collector_type,
    get_theme_stats,
    get_market_snapshot,
)
from app.ml.scoring import score_limit_up_batch  # noqa: E402
from app.ml.strategy_pool import get_pool  # noqa: E402
from app.ml.world_model import get_world_env, apply_env_weights  # noqa: E402

# 输出目录
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend", "public", "snapshot",
)


def _write_json(name: str, data) -> str:
    path = os.path.join(OUT_DIR, name)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def _simplify_record(rec: dict) -> dict:
    """精简为用户指定的 limitup.json 字段结构。"""
    code = str(rec.get("code", ""))
    return {
        "code": code,
        "name": str(rec.get("name", "")),
        "price": round(float(rec.get("close", 0)), 2),
        "limit_price": round(float(rec.get("close", 0)) / (1 + float(rec.get("pct_chg", 10)) / 100), 2),
        "fb_count": int(rec.get("boards", 1)),          # 连板数
        "fd_amount": round(float(rec.get("seal_amount", 0)) / 1e4, 0),  # 封单额（万元）
        "reason": str(rec.get("reason", "")),
        "industry": str(rec.get("industry", "")),
    }


def main() -> int:
    t0 = time.time()
    print("=" * 62)
    print("Limit-Up Quant AI — 涨停快照生成")
    print(f"  SOURCE_MODE = {settings.SOURCE_MODE}")
    print(f"  输出目录     = {OUT_DIR}")
    print("=" * 62)

    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. 获取最近交易日
    trade_date = get_latest_trade_date()
    collector = get_collector_type()
    print(f"\n[1/6] 交易日: {trade_date}  数据源: {collector}")

    # 2. 抓取涨停数据（CI 容错：akshare 失败时强制降级模拟器，保证部署永远有内容）
    print("\n[2/6] 抓取涨停池...")
    records: list[dict] = []
    try:
        records = get_limit_up_data(trade_date)
    except Exception as e:
        print(f"  ⚠ 抓取涨停池异常: {e}")

    if not records:
        print("  ⚠ 涨停池为空（可能是非交易日/海外节点连不上东方财富/akshare 异常）")
        # 关键兜底：无论 akshare 还是 auto 模式，空数据都降级模拟器，保证部署不空
        print("  → 强制降级为模拟器数据（保证部署永远有内容）")
        prev_mode = settings.SOURCE_MODE
        settings.SOURCE_MODE = "simulator"  # type: ignore
        from app.data.provider import _clear_cache
        _clear_cache()
        records = get_limit_up_data(trade_date)
        # 重新判定数据源标识
        collector = get_collector_type()
        print(f"  降级后数据源: {collector}（原模式: {prev_mode}）, 获取 {len(records)} 条")

    print(f"  获取 {len(records)} 条涨停记录")

    # 3. 生成 limitup.json
    simplified = [_simplify_record(r) for r in records]
    snapshot = {
        "trade_date": trade_date,
        "source": collector,
        "count": len(simplified),
        "records": simplified,
    }
    path = _write_json("limitup.json", snapshot)
    print(f"\n[3/6] 写入 limitup.json ({os.path.getsize(path):,} bytes)")
    print(f"  样例: {json.dumps(simplified[0], ensure_ascii=False) if simplified else '(空)'}")

    # 4. AI 评分：5 维评分 + 双评级 + 因果解释 → scanner_potential.json + ranking.json
    print(f"\n[4/6] AI 5 维评分引擎...")

    # 4a. 策略池：获取主策略权重
    pool = get_pool()
    active_strategy = pool.get_active_strategy()
    base_weights = active_strategy.weights
    print(f"  主策略: [{active_strategy.style}] {active_strategy.version}  fitness={active_strategy.fitness}")

    # 4b. 世界模型：判断市场环境 + 微调权重
    snap = get_market_snapshot(trade_date)
    world_env = get_world_env(records, snap)
    env_label = world_env["environment"]
    final_weights = apply_env_weights(base_weights, env_label)
    print(f"  市场环境: {env_label}  置信系数: {world_env['confidence_factor']}")
    print(f"  权重微调: {{{', '.join(f'{k}:{round(v,3)}' for k, v in final_weights.items())}}}")

    # 4c. 评分（使用策略池主策略 + 环境微调后的权重）
    theme_stats_raw = get_theme_stats(trade_date)
    theme_stats = {t["name"]: t["count"] for t in theme_stats_raw}
    scored = score_limit_up_batch(records, theme_stats, final_weights)
    print(f"  评分完成：{len(scored)} 只")

    # 评分分布统计
    if scored:
        abs_dist = {}
        rel_dist = {}
        for s in scored:
            abs_dist[s["abs_grade"]] = abs_dist.get(s["abs_grade"], 0) + 1
            rel_dist[s["rel_grade"]] = rel_dist.get(s["rel_grade"], 0) + 1
        print(f"  绝对评级分布: {dict(sorted(abs_dist.items()))}")
        print(f"  相对评级分布: {dict(sorted(rel_dist.items()))}")
        scores_list = [s["total_score"] for s in scored]
        print(f"  总分范围: {min(scores_list):.1f} ~ {max(scores_list):.1f}  均值: {sum(scores_list)/len(scores_list):.1f}")

    # scanner_potential.json：今日涨停潜力榜（按总分降序，前 60 只）
    top_60 = scored[:60]
    scanner_data = {
        "trade_date": trade_date,
        "source": collector,
        "total_candidates": len(scored),
        "environment": env_label,
        "active_strategy": active_strategy.style,
        "weights": {k: round(v, 4) for k, v in final_weights.items()},
        "ranking": [
            {
                "rank": i + 1,
                "code": s["code"],
                "name": s["name"],
                "boards": s["boards"],
                "price": round(s["price"], 2),
                "industry": s["industry"],
                "concepts": s["concepts"],
                "total_score": s["total_score"],
                "sub_scores": s["sub_scores"],
                "abs_grade": s["abs_grade"],
                "rel_grade": s["rel_grade"],
                "percentile": s["percentile"],
                "reason": s["reason"],
                "explain": s["explain"],
            }
            for i, s in enumerate(top_60)
        ],
    }
    path = _write_json("scanner_potential.json", scanner_data)
    print(f"  ✓ scanner_potential.json ({len(top_60)} 条, {os.path.getsize(path):,} bytes)")

    # ranking.json：AI 接力排行榜（全量，聚焦"最值得接力"）
    ranking_data = {
        "trade_date": trade_date,
        "source": collector,
        "count": len(scored),
        "environment": env_label,
        "active_strategy": active_strategy.style,
        "ranking": [
            {
                "rank": i + 1,
                "code": s["code"],
                "name": s["name"],
                "boards": s["boards"],
                "price": round(s["price"], 2),
                "total_score": s["total_score"],
                "sub_scores": s["sub_scores"],
                "abs_grade": s["abs_grade"],
                "rel_grade": s["rel_grade"],
                "percentile": s["percentile"],
                "reason": s["reason"],
                "explain": s["explain"],
                "industry": s["industry"],
                "seal_time": s["seal_time"],
                "break_times": s["break_times"],
                "limit_type": s["limit_type"],
                "float_mv": s["float_mv"],
                "turnover": s["turnover"],
                "amount": s["amount"],
            }
            for i, s in enumerate(scored)
        ],
    }
    path = _write_json("ranking.json", ranking_data)
    print(f"  ✓ ranking.json ({len(scored)} 条, {os.path.getsize(path):,} bytes)")

    # 5. 策略池 + 世界模型健康快照
    print(f"\n[5/6] 策略池 + 世界模型...")

    # health_pool.json
    pool_summary = pool.summary()
    _write_json("health_pool.json", pool_summary)
    print(f"  ✓ health_pool.json ({len(pool_summary.get('pool', []))} 策略, 主策略={pool_summary.get('active_style','')})")

    # health_world.json
    _write_json("health_world.json", world_env)
    print(f"  ✓ health_world.json (环境={env_label})")

    # 6. 附加 + 元数据
    print(f"\n[6/6] 附加数据...")
    if settings.SOURCE_MODE in ("akshare", "auto"):
        print("  抓取昨日涨停今日表现...")
        prev = get_previous_limit_up(trade_date)
        if prev:
            _write_json("limitup_previous.json", {
                "trade_date": trade_date,
                "source": "akshare",
                "count": len(prev),
                "records": prev,
            })
            print(f"  ✓ limitup_previous.json ({len(prev)} 条)")
        else:
            print("  - 昨日涨停数据不可用")

    _write_json("meta.json", {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "trade_date": trade_date,
        "collector": collector,
        "source_mode": settings.SOURCE_MODE,
        "endpoints": 5,
        "details": 0,
        "detail_codes": [],
        "mode": "static-snapshot",
        "environment": env_label,
        "active_strategy": active_strategy.style,
    })
    print(f"  ✓ meta.json")

    elapsed = time.time() - t0
    print("\n" + "=" * 62)
    print(f"完成：{len(simplified)} 条涨停记录，{len(scored)} 条AI评分，环境={env_label}，数据源 {collector}，耗时 {elapsed:.1f}s")
    print(f"输出：{OUT_DIR}")
    print("=" * 62)
    return 0


if __name__ == "__main__":
    sys.exit(main())
