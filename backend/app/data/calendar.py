"""A股交易日历（沪深两市）。"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from functools import lru_cache

# 2025-2026 主要法定休市日（简化版，生产环境应对接交易所日历接口）
HOLIDAYS: set[str] = {
    # 2025
    "2025-01-01", "2025-01-28", "2025-01-29", "2025-01-30", "2025-01-31",
    "2025-02-03", "2025-02-04", "2025-04-04", "2025-05-01", "2025-05-02",
    "2025-05-05", "2025-06-02", "2025-10-01", "2025-10-02", "2025-10-03",
    "2025-10-06", "2025-10-07", "2025-10-08",
    # 2026
    "2026-01-01", "2026-01-02", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-02-19", "2026-02-20", "2026-04-06", "2026-05-01", "2026-06-19",
    "2026-09-25", "2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06",
    "2026-10-07", "2026-10-08",
}


def is_trade_day(d: date | str) -> bool:
    if isinstance(d, str):
        d = datetime.strptime(d, "%Y-%m-%d").date()
    if d.weekday() >= 5:
        return False
    return d.isoformat() not in HOLIDAYS


def prev_trade_day(d: date | str, n: int = 1) -> str:
    if isinstance(d, str):
        d = datetime.strptime(d, "%Y-%m-%d").date()
    cnt = 0
    cur = d
    while cnt < n:
        cur -= timedelta(days=1)
        if is_trade_day(cur):
            cnt += 1
    return cur.isoformat()


def next_trade_day(d: date | str, n: int = 1) -> str:
    if isinstance(d, str):
        d = datetime.strptime(d, "%Y-%m-%d").date()
    cnt = 0
    cur = d
    while cnt < n:
        cur += timedelta(days=1)
        if is_trade_day(cur):
            cnt += 1
    return cur.isoformat()


@lru_cache(maxsize=8)
def trade_days_between(start: str, end: str) -> tuple[str, ...]:
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    out: list[str] = []
    cur = s
    while cur <= e:
        if is_trade_day(cur):
            out.append(cur.isoformat())
        cur += timedelta(days=1)
    return tuple(out)


def recent_trade_days(end: str, count: int) -> list[str]:
    """返回截至 end（含）的最近 count 个交易日，升序。"""
    e = datetime.strptime(end, "%Y-%m-%d").date()
    out: list[str] = []
    cur = e
    while len(out) < count:
        if is_trade_day(cur):
            out.append(cur.isoformat())
        cur -= timedelta(days=1)
    return sorted(out)


def latest_trade_day(ref: date | str | None = None) -> str:
    """最近一个已收盘交易日（15:00 后当日算收盘）。"""
    now = datetime.now()
    if ref is None:
        d = now.date()
        if not is_trade_day(d) or now.hour < 15:
            return prev_trade_day(d)
        return d.isoformat()
    if isinstance(ref, str):
        ref = datetime.strptime(ref, "%Y-%m-%d").date()
    return ref.isoformat() if is_trade_day(ref) else prev_trade_day(ref)
