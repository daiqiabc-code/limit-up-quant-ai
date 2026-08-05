"""AI 学习系统 + 历史回测路由。"""

from fastapi import APIRouter, Query

from app.ml.learning import get_engine

router = APIRouter(prefix="/api/learning", tags=["AI 学习"])


@router.get("/stats")
def learning_stats():
    engine = get_engine()
    return engine.get_learning_stats()


@router.get("/check")
def check_retrain():
    engine = get_engine()
    return engine.check_retrain()


@router.post("/verify")
def verify_predictions(trade_date: str = Query(...), next_date: str = Query(...)):
    engine = get_engine()
    return engine.verify_predictions(trade_date, next_date)


@router.post("/retrain")
def retrain(trade_date: str = Query(...)):
    engine = get_engine()
    return engine.retrain(trade_date)


@router.get("/backtest")
def backtest(trade_date: str | None = Query(None)):
    """历史回测：在某日预测后，验证真实结果。"""
    from app.data.provider import get_available_dates, get_limit_up_data

    dates = get_available_dates()
    if not dates:
        return {"error": "无数据"}

    target = trade_date or dates[-2] if len(dates) >= 2 else dates[-1]
    try:
        idx = dates.index(target)
    except ValueError:
        return {"error": f"日期 {target} 不在数据范围内"}

    next_date = dates[idx + 1] if idx + 1 < len(dates) else None
    if not next_date:
        return {"error": "无下一天数据"}

    engine = get_engine()
    # 先生成预测
    from app.data.provider import get_model_prediction
    limits = get_limit_up_data(target)
    predictions = [get_model_prediction(target, r["code"]) for r in limits]
    predictions = [p for p in predictions if p]

    # 验证
    engine.verify_predictions(target, next_date)

    # 获取验证结果
    from app.core.db import SessionLocal
    from app.models import Prediction

    db = SessionLocal()
    try:
        preds = (
            db.query(Prediction)
            .filter(Prediction.trade_date == target, Prediction.verified == True)
            .order_by(Prediction.rank.asc())
            .all()
        )
        top10 = sum(1 for p in preds[:10] if p.hit) / max(1, min(10, len(preds)))
        top20 = sum(1 for p in preds[:20] if p.hit) / max(1, min(20, len(preds)))

        results = [{
            "rank": i + 1, "code": p.code, "name": p.name,
            "prob_limit_up": p.prob_limit_up, "grade": p.grade,
            "actual_pct": p.actual_pct, "actual_limit_up": p.actual_limit_up, "hit": p.hit,
        } for i, p in enumerate(preds)]

        wins = [r["actual_pct"] for r in results if r["actual_pct"] > 0]
        losses = [r["actual_pct"] for r in results if r["actual_pct"] <= 0]
        avg_win = sum(wins) / max(1, len(wins))
        avg_loss = abs(sum(losses)) / max(1, len(losses))

        cum = 1.0; peak, max_dd = 1.0, 0.0
        for r in results:
            cum *= (1 + r["actual_pct"] / 100)
            peak = max(peak, cum)
            max_dd = max(max_dd, (peak - cum) / peak)

        return {
            "trade_date": target,
            "next_date": next_date,
            "total": len(results),
            "limit_up_count": sum(1 for r in results if r["actual_limit_up"]),
            "up_count": sum(1 for r in results if r["actual_pct"] > 0),
            "avg_return": round(sum(r["actual_pct"] for r in results) / max(1, len(results)), 2) if results else 0,
            "top10_precision": round(top10, 4),
            "top20_precision": round(top20, 4),
            "win_rate": round(len(wins) / max(1, len(results)), 4),
            "profit_loss_ratio": round(avg_win / max(0.01, avg_loss), 2),
            "max_drawdown": round(max_dd * 100, 2),
            "cumulative_return": round((cum - 1) * 100, 2),
            "results": results,
        }
    finally:
        db.close()


@router.get("/logs")
def learning_logs(limit: int = Query(20)):
    from app.core.db import SessionLocal
    from app.models import LearningLog

    db = SessionLocal()
    try:
        logs = db.query(LearningLog).order_by(LearningLog.created_at.desc()).limit(limit).all()
        return {
            "logs": [{
                "id": l.id, "trade_date": l.trade_date, "event": l.event,
                "summary": l.summary, "metrics": l.metrics,
                "created_at": str(l.created_at)[:19],
            } for l in logs],
        }
    finally:
        db.close()


@router.get("/calibration")
def calibration_status():
    """返回最新的权重校准结果。"""
    import json, os
    from app.config import settings
    from app.ml.scoring import get_model

    model = get_model()
    path = os.path.join(settings.ML_MODEL_DIR, "calibrated_weights.json")
    calib = None
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            calib = json.load(f)

    report_path = os.path.join(settings.ML_MODEL_DIR, "calibration_report.md")
    report = ""
    if os.path.exists(report_path):
        with open(report_path, encoding="utf-8") as f:
            report = f.read()

    return {
        "active_model": model.version,
        "weights": model.weights,
        "calibrated": calib,
        "report": report,
    }
