"""CI 静态构建脚本 — 直接调用 Provider 函数，无需启动后端 HTTP 服务。

用法： cd backend && python -m scripts.ci_build
输出： frontend/public/snapshot/*.json（与 make_snapshot 相同格式）
"""

import json
import os
import sys
import time
from datetime import date

# 确保能找到 app 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.data.provider import (
    get_latest_trade_date,
    get_limit_up_data,
    get_model_prediction,
    get_collector_type,
    get_available_dates,
    scan_potential_limit_up,
)
from app.ml.health import get_model_health, get_evolution_health
from app.ml.strategy_pool import get_pool
from app.ml.world_model import get_world

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "snapshot")
os.makedirs(OUT, exist_ok=True)

trade_date = get_latest_trade_date()
print(f"CI Build — 交易日 {trade_date}")
t0 = time.time()


def write_json(name: str, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  ✓ {name} ({len(f.getvalue()):,} bytes)")
    return path


# ---- 核心接口 ----
write_json("health.json", {"status": "ok", "app": "Limit-Up Quant AI", "collector": get_collector_type()})

limits = get_limit_up_data(trade_date)
write_json("limitup.json", {"trade_date": trade_date, "count": len(limits), "records": limits})

# AI 排行榜
predictions = []
for rec in limits[:80]:  # 限制数量避免 Actions 超时
    pred = get_model_prediction(trade_date, rec["code"])
    if pred:
        predictions.append({
            "rank": 0, "code": pred["code"], "name": pred["name"],
            "prob_limit_up": pred["prob_limit_up"],
            "prob_up": pred["prob_up"],
            "prob_big_up": pred["prob_big_up"],
            "total_score": pred["total_score"],
            "grade": pred["grade"],
            "risk_level": pred["risk_level"],
            "advice": pred["advice"],
            "boards": rec.get("boards", 1),
            "reasons": pred.get("reasons", []),
        })
predictions.sort(key=lambda x: -x["prob_limit_up"])
from app.ml.scoring import compute_pool_grades
probs = [p["prob_limit_up"] for p in predictions]
pgs = compute_pool_grades(probs)
for i, p in enumerate(predictions):
    if i < len(pgs):
        p["rank"] = i + 1
        p["rel_grade"] = pgs[i]["rel_grade"]
        p["percentile"] = pgs[i]["percentile"]
write_json("ranking.json", {"trade_date": trade_date, "count": len(predictions), "ranking": predictions})

write_json("dates.json", {"dates": get_available_dates()})

# 分析模块（简化版）
from app.data.provider import get_theme_stats
write_json("analysis_industry.json", {"trade_date": trade_date, "industries": []})
write_json("analysis_theme.json", {"trade_date": trade_date, "themes": [{"name": t, "count": c} for t, c in get_theme_stats(trade_date).items()][:20]})
write_json("analysis_sentiment.json", {"trade_date": trade_date, "score": 50})
write_json("analysis_dragon.json", {"trade_date": trade_date, "records": []})

# 扫描器
potential = scan_potential_limit_up(trade_date, limit=10)
for d in potential:
    d["rel_grade"] = "B"
    d["percentile"] = 50
write_json("scanner_potential.json", {"trade_date": trade_date, "total_candidates": len(potential), "ranking": potential})

# 健康
write_json("health_model.json", get_model_health())
write_json("health_evolution.json", get_evolution_health())
write_json("health_pool.json", get_pool().summary())
write_json("health_world.json", get_world().summary())

# 学习模块占位
write_json("learning_stats.json", {"model_version": "ci", "total_predictions": 0, "accuracy": 0})
write_json("learning_backtest.json", {"trade_date": trade_date, "result": []})
write_json("learning_logs.json", {"logs": []})
write_json("learning_calibration.json", {"status": "not_run"})

# 元信息
write_json("meta.json", {
    "trade_date": trade_date,
    "collector": get_collector_type(),
    "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    "build_type": "ci",
})

elapsed = time.time() - t0
print(f"\nCI Build 完成: {len(predictions)} 只预测, {elapsed:.1f}s")
