"""涨停数据 + AI 排行榜路由。"""

from fastapi import APIRouter, Query

from app.data.provider import get_available_dates, get_limit_up_data, get_latest_trade_date, get_model_prediction
from app.ml.scoring import compute_pool_grades

router = APIRouter(prefix="/api/limitup", tags=["涨停 & 排行榜"])


@router.get("")
def list_limit_up(trade_date: str | None = Query(None)):
    date = trade_date or get_latest_trade_date()
    raw = get_limit_up_data(date)
    return {"trade_date": date, "count": len(raw), "records": raw}


@router.get("/ranking")
def ai_ranking(trade_date: str | None = Query(None)):
    """AI 排行榜（按继续涨停概率从高到低，含绝对+相对双维评级）。"""
    date = trade_date or get_latest_trade_date()
    raw = get_limit_up_data(date)
    predictions = []
    for rec in raw:
        pred = get_model_prediction(date, rec["code"])
        if pred:
            predictions.append({
                "rank": 0,
                "code": pred["code"],
                "name": pred["name"],
                "prob_limit_up": pred["prob_limit_up"],
                "prob_up": pred["prob_up"],
                "prob_big_up": pred["prob_big_up"],
                "total_score": pred["total_score"],
                "grade": pred["grade"],          # 绝对概率评级（模型原始输出）
                "risk_level": pred["risk_level"],
                "advice": pred["advice"],
                "boards": rec.get("boards", 1),
                "reasons": pred.get("reasons", []),
            })
    # 按概率排序 + 池内百分位相对评级
    predictions.sort(key=lambda x: -x["prob_limit_up"])
    probs = [p["prob_limit_up"] for p in predictions]
    pool_grades = compute_pool_grades(probs)
    for i, p in enumerate(predictions):
        pg = pool_grades[i]
        p["rank"] = i + 1
        p["rel_grade"] = pg["rel_grade"]        # 相对评级：池内百分位 S/A/B/C/D
        p["percentile"] = pg["percentile"]      # 池内百分位排名（越高越好）
    return {"trade_date": date, "count": len(predictions), "ranking": predictions}


@router.get("/dates")
def available_dates():
    return {"dates": get_available_dates()}
