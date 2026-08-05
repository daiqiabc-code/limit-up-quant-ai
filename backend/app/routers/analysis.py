"""行业分析 / 题材分析 / 市场情绪 / 龙虎榜路由。"""

from fastapi import APIRouter, Query

from app.data.provider import (
    get_dragon_tiger,
    get_industry_stats,
    get_latest_trade_date,
    get_market_snapshot,
    get_theme_stats,
)

router = APIRouter(prefix="/api/analysis", tags=["分析"])


@router.get("/industry")
def industry_analysis(trade_date: str | None = Query(None)):
    date = trade_date or get_latest_trade_date()
    return {"trade_date": date, "industries": get_industry_stats(date)}


@router.get("/theme")
def theme_analysis(trade_date: str | None = Query(None)):
    date = trade_date or get_latest_trade_date()
    return {"trade_date": date, "themes": get_theme_stats(date)}


@router.get("/sentiment")
def market_sentiment(trade_date: str | None = Query(None)):
    snap = get_market_snapshot(trade_date)
    # 情绪时序（简化：最近 30 天）
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    recent = data[-30:]
    timeline = [
        {
            "date": d.trade_date,
            "cycle": d.snapshot["cycle"],
            "temp": d.snapshot["temperature"],
            "profit": d.snapshot["profit_effect"],
            "limit_up": d.snapshot["limit_up_count"],
            "limit_down": d.snapshot["limit_down_count"],
            "consecutive": d.snapshot["consecutive_count"],
            "break_rate": d.snapshot["break_rate"],
            "total_amount": d.snapshot["total_amount"],
        }
        for d in recent
    ]
    return {"current": snap, "timeline": timeline}


@router.get("/dragon")
def dragon_analysis(trade_date: str | None = Query(None)):
    date = trade_date or get_latest_trade_date()
    rows = get_dragon_tiger(date)
    # 汇总
    by_seat: dict[str, dict] = {}
    for r in rows:
        s = r["seat"]
        if s not in by_seat:
            by_seat[s] = {"seat": s, "tag": r["tag"], "type": r["seat_type"],
                           "total_buy": 0, "total_sell": 0, "count": 0, "stocks": []}
        by_seat[s]["total_buy"] += r["buy"]
        by_seat[s]["total_sell"] += r["sell"]
        by_seat[s]["count"] += 1
        if r["code"] not in by_seat[s]["stocks"]:
            by_seat[s]["stocks"].append(r["code"])
    seats_summary = []
    for v in by_seat.values():
        v["net"] = v["total_buy"] - v["total_sell"]
        seats_summary.append(v)
    seats_summary.sort(key=lambda x: -x["net"])
    return {"trade_date": date, "records": rows, "seats_summary": seats_summary}
