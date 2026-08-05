"""股票详情 + K 线 + AI 分析路由。"""

from fastapi import APIRouter, Query

from app.data.provider import (
    get_dragon_tiger,
    get_latest_trade_date,
    get_limit_up_data,
    get_model_prediction,
    get_news,
    get_quotes,
    get_stock_meta,
)

router = APIRouter(prefix="/api/detail", tags=["股票详情"])


@router.get("/{code}")
def stock_detail(
    code: str,
    trade_date: str | None = Query(None),
    bars: int = Query(60),
):
    date = trade_date or get_latest_trade_date()
    meta = get_stock_meta(code)
    quotes = get_quotes(code, bars)
    limits = get_limit_up_data(date)
    rec = next((r for r in limits if r["code"] == code), None)
    dragon = get_dragon_tiger(date, code)
    news = get_news(date, code)
    pred = get_model_prediction(date, code)

    return {
        "trade_date": date,
        "stock": meta,
        "limit_up_record": rec,
        "quotes": quotes,
        "dragon_tiger": dragon,
        "news": news,
        "prediction": pred,
    }
