"""今日涨停潜力扫描路由。"""

from datetime import date as dt_date

from fastapi import APIRouter, Query

from app.data.provider import scan_potential_limit_up
from app.ml.scoring import compute_pool_grades

router = APIRouter(prefix="/api/scanner", tags=["涨停潜力扫描"])


@router.get("/potential")
def potential_limit_up(
    trade_date: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50, description="返回数量"),
):
    """扫描当日强势股，按涨停潜力排名，返回 Top N（含绝对+相对双维评级）。"""
    date = trade_date or dt_date.today().strftime("%Y%m%d")
    data = scan_potential_limit_up(date, limit=limit)
    # 池内相对评级
    scores = [d["total_score"] for d in data]
    pool_grades = compute_pool_grades(scores)
    for i, d in enumerate(data):
        d["rel_grade"] = pool_grades[i]["rel_grade"]
        d["percentile"] = pool_grades[i]["percentile"]
    return {
        "trade_date": date,
        "total_candidates": len(data),
        "ranking": data,
    }
