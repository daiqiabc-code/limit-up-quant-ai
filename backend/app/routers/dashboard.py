"""Dashboard 数据路由。"""

from fastapi import APIRouter

from app.data.provider import get_collector_type, get_market_snapshot, get_theme_stats

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("")
def get_dashboard():
    snap = get_market_snapshot()
    themes = get_theme_stats()
    return {
        "snapshot": snap,
        "hot_themes": themes[:6],
        "collector": get_collector_type(),
        "data_time": snap.get("trade_date", "—") if snap else "—",
    }
