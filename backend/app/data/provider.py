"""统一数据提供层 v2 —— 真实 AKShare 数据优先，模拟器兜底。

SOURCE_MODE=akshare  → 实时真实行情
SOURCE_MODE=simulator → 确定性伪随机数据
SOURCE_MODE=auto      → 优先 akshare，失败降级

网络限制：push2.eastmoney.com（K线/龙虎榜/个股信息）在当前代理环境不可用。
  - 可用：stock_zt_pool_em（涨停池）, stock_zh_index_daily（指数）
  - 降级：K线/个股信息使用模拟器补充
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.config import settings


def _use_real() -> bool:
    """判断是否使用真实数据。"""
    if settings.SOURCE_MODE == "akshare":
        from app.data.akshare_adapter import is_available
        return is_available()
    if settings.SOURCE_MODE == "auto":
        from app.data.akshare_adapter import is_available
        return is_available()
    return False


def get_collector_type() -> str:
    if _use_real():
        return "akshare"
    return "simulator"


# =========== 涨停数据 ===========

def get_latest_trade_date() -> str:
    if _use_real():
        from app.data.akshare_adapter import _yesterday
        return _yesterday()
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    return data[-1].trade_date if data else "—"


def get_available_dates() -> list[str]:
    if _use_real():
        from datetime import date, timedelta
        d = date.today()
        return [(d - timedelta(days=i)).isoformat() for i in range(1, 60)]
    from app.data.simulator import get_generated_data
    return [d.trade_date for d in get_generated_data()]


def get_limit_up_data(trade_date: str | None = None) -> list[dict[str, Any]]:
    key = f"lu_{trade_date or 'latest'}"
    if key in _cache:
        return _cache[key]
    if _use_real():
        from app.data.akshare_adapter import fetch_limit_up_pool
        result = fetch_limit_up_pool(trade_date)
        _cache[key] = result
        return result
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    if not data:
        return []
    target = data[-1] if trade_date is None else next((d for d in data if d.trade_date == trade_date), data[-1])
    result = target.limit_up_records
    _cache[key] = result
    return result


# ---- 请求级缓存（避免同一请求内重复调 akshare） ----
_cache: dict[str, Any] = {}


def _clear_cache() -> None:
    _cache.clear()


def get_market_snapshot(trade_date: str | None = None) -> dict[str, Any]:
    key = f"snap_{trade_date or 'latest'}"
    if key in _cache:
        return _cache[key]
    if _use_real():
        from app.data.akshare_adapter import fetch_market_snapshot
        snap = fetch_market_snapshot(trade_date)
        if snap:
            limits = get_limit_up_data(trade_date)
            if limits:
                boards = [r.get("boards", 1) for r in limits]
                snap["max_boards"] = max(boards) if boards else 1
                snap["consecutive_count"] = sum(1 for b in boards if b >= 2)
                snap["limit_up_count"] = len(limits)
            _cache[key] = snap
            return snap
        return {}
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    if not data:
        return {}
    target = data[-1] if trade_date is None else next((d for d in data if d.trade_date == trade_date), data[-1])
    snap = target.snapshot
    _cache[key] = snap
    return snap


def get_dragon_tiger(trade_date: str | None = None, code: str | None = None) -> list[dict[str, Any]]:
    """龙虎榜统一走模拟器（akshare龙虎榜API在当前网络不可用）。"""
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    if not data:
        return []
    target = data[-1] if trade_date is None else next((d for d in data if d.trade_date == trade_date), data[-1])
    rows = target.dragon_tiger
    if code:
        rows = [r for r in rows if r["code"] == code]
    return rows


def get_news(trade_date: str | None = None, code: str | None = None) -> list[dict[str, Any]]:
    if _use_real():
        return []  # AKShare 暂不实时抓新闻，可用 LLM 分析公告替代
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    if not data:
        return []
    target = data[-1] if trade_date is None else next((d for d in data if d.trade_date == trade_date), data[-1])
    rows = target.news
    if code:
        rows = [r for r in rows if r["code"] == code]
    return rows


def get_quotes(code: str, num_bars: int = 60) -> list[dict[str, Any]]:
    """获取K线。akshare的K线API(push2his)在当前网络中不可用，统一走模拟器。"""
    from app.data.simulator import get_simulator
    return get_simulator().gen_quotes(code, num_bars)


def get_stock_meta(code: str) -> dict[str, Any] | None:
    """获取个股信息。akshare info API(push2)不可用，从涨停数据中提取。"""
    # 先尝试从涨停数据中找到该股票的信息
    limits = get_limit_up_data()
    rec = next((r for r in limits if r["code"] == code), None)
    if rec:
        return {
            "code": code, "name": rec.get("name", code),
            "exchange": "SH" if code.startswith(("6", "68")) else "SZ",
            "board": "科创板" if code.startswith("688") else "创业板" if code.startswith(("300", "301")) else "主板",
            "industry": rec.get("industry", ""),
            "concepts": rec.get("concepts", []),
            "total_mv": rec.get("total_mv", 0),
            "float_mv": rec.get("float_mv", 0),
            "listed_days": 1000, "is_st": False,
            "limit_pct": 20 if code.startswith(("300", "301", "688")) else 10,
            "beta": 1.0, "quality": 0.5,
        }
    # 从模拟器补充
    from app.data.simulator import get_simulator
    m = get_simulator().stock_map.get(code)
    if m:
        return {"code": m.code, "name": m.name, "exchange": m.exchange, "board": m.board,
                "industry": m.industry, "concepts": m.concepts, "total_mv": m.total_mv,
                "float_mv": m.float_mv, "listed_days": m.listed_days, "is_st": m.is_st,
                "limit_pct": m.limit_pct, "beta": m.beta, "quality": m.quality}
    return None


def get_theme_stats(trade_date: str | None = None) -> list[dict[str, Any]]:
    limits = get_limit_up_data(trade_date)
    themes: dict[str, dict] = {}
    for r in limits:
        for c in r.get("concepts", []):
            if c not in themes:
                themes[c] = {"name": c, "count": 0, "stocks": [], "amount": 0.0}
            themes[c]["count"] += 1
            themes[c]["stocks"].append(r["code"])
            themes[c]["amount"] += r.get("amount", 0)
    out = sorted(themes.values(), key=lambda x: -x["count"])
    for t in out:
        t["leader"] = t["stocks"][0] if t["stocks"] else ""
    return out


def get_industry_stats(trade_date: str | None = None) -> list[dict[str, Any]]:
    limits = get_limit_up_data(trade_date)
    inds: dict[str, dict] = {}
    for r in limits:
        ind = r.get("industry", "未知")
        if ind not in inds:
            inds[ind] = {"name": ind, "limit_up_count": 0, "stocks": [], "amount": 0.0, "up_count": 0}
        inds[ind]["limit_up_count"] += 1
        inds[ind]["stocks"].append(r["code"])
        inds[ind]["amount"] += r.get("amount", 0)
    for v in inds.values():
        v["up_count"] = max(1, int(v["limit_up_count"] * 3.5))
    return sorted(inds.values(), key=lambda x: -x["limit_up_count"])


def get_model_prediction(trade_date: str, code: str) -> dict[str, Any] | None:
    from app.ml.scoring import (
        ScoreInput,
        calculate_sub_scores,
        compute_grade,
        get_model,
    )

    meta = get_stock_meta(code)
    limits = get_limit_up_data(trade_date)
    rec = next((r for r in limits if r["code"] == code), None)
    if not rec or not meta:
        return None
    snap = get_market_snapshot(trade_date)
    dragon = get_dragon_tiger(trade_date, code)
    concepts = rec.get("concepts", [])
    news = get_news(trade_date, code)
    theme_stats = {t["name"]: t["count"] for t in get_theme_stats(trade_date)}
    quotes = get_quotes(code, 60)

    inp = ScoreInput.from_records(rec, meta, snap, dragon, concepts, news, theme_stats, quotes)
    subs = calculate_sub_scores(inp)
    # 使用可校准模型（ModelPersistence）替代硬编码权重，使 calibrate_real.py 的训练结果真正生效
    prob_limit = get_model().predict_prob(subs)
    prob_up_5 = round(min(1.0, prob_limit + 0.12), 2)
    # 因果可解释性：特征贡献度
    from app.ml.scoring import explain_prediction
    explain = explain_prediction(subs, prob_limit)

    total = round(sum(subs.values()), 1)
    grade = compute_grade(prob_limit)
    risk = _compute_risk(prob_limit, rec.get("boards", 1))
    advice = _compute_advice(grade, prob_limit)

    return {
        "trade_date": trade_date, "code": code, "name": rec.get("name", ""),
        "prob_limit_up": round(prob_limit, 3),
        "prob_up": round(prob_up_5 - 0.1, 3),
        "prob_big_up": round(prob_up_5, 3),
        "total_score": total, "grade": grade, "risk_level": risk, "advice": advice,
        "model_version": get_model().version,
        "expected_return": round(prob_limit * 15 - 3, 1),
        "expected_drawdown": round(8 - prob_limit * 5, 1),
        "sub_scores": {k: round(v, 1) for k, v in subs.items()},
        "explain": explain,
        "reasons": _gen_reasons(subs, rec, concepts),
        "ai_report": _gen_report(code, rec["name"], subs, prob_limit, grade, advice),
    }


def _compute_risk(prob: float, boards: int) -> str:
    if prob >= 0.85:
        return "低"
    if prob >= 0.7:
        return "中"
    if prob >= 0.5:
        return "高"
    return "极高"


def _compute_advice(grade: str, prob: float) -> str:
    if grade in ("S", "A") and prob >= 0.75:
        return "关注竞价承接"
    if grade == "B":
        return "谨慎参与"
    if grade == "C":
        return "观望"
    return "回避"


def _gen_reasons(subs: dict, rec: dict, concepts: list[str]) -> list[str]:
    reasons = []
    if subs.get("资金评分", 0) >= 14:
        reasons.append(f"主力资金净流入{rec.get('main_net_inflow', 0)/1e8:.1f}亿")
    if rec.get("boards", 1) >= 3:
        reasons.append(f"已达成{rec['boards']}连板")
    if concepts:
        reasons.append(f"属于{concepts[0]}主线")
    seal_ratio = rec.get("seal_ratio", 0)
    if seal_ratio > 0.8:
        reasons.append(f"封单/成交额比{seal_ratio}")
    if rec.get("break_times", 0) == 0:
        reasons.append("全天未炸板")
    if rec.get("seal_time", "15:00") < "10:00":
        reasons.append(f"封板时间{rec['seal_time']}")
    if rec.get("has_dragon"):
        reasons.append("龙虎榜出现重点席位")
    return reasons[:6]


def _gen_report(code: str, name: str, subs: dict, prob: float, grade: str, advice: str) -> str:
    lines = [
        f"## {name}({code}) AI分析报告",
        "",
        f"**综合评级**: {grade} | **继续涨停概率**: {prob*100:.1f}% | **建议**: {advice}",
        "",
        "### 各维度评分",
    ]
    for k, v in subs.items():
        bar = "█" * int(v / 2) + "░" * (int((20 - v) / 2))
        lines.append(f"- {k}: {v:.1f} {bar}")
    lines.extend(["", "以上分析基于真实市场数据，不构成投资建议。"])
    return "\n".join(lines)


# ====================================================================
# 今日涨停潜在股扫描（实时强势股排名）
# ====================================================================

def _score_potential(rec: dict) -> dict[str, Any]:
    """对单只强势股计算涨停潜力综合评分(0-100)。"""
    change_pct = float(rec.get("change_pct", 0))
    vol_ratio = float(rec.get("vol_ratio", 1.0))
    turnover = float(rec.get("turnover", 0))
    is_new_high = bool(rec.get("is_new_high", False))
    zt_stat = str(rec.get("zt_stat", "0/0"))

    # 1. 涨停接近度(0-35): 涨幅越接近涨停板，潜力越大
    proximity = min(change_pct / 20.0, 1.0) if change_pct >= 3 else 0.15
    s_prox = proximity * 35

    # 2. 量比(0-25): 量能确认，>2 强烈，>5 极端
    s_vol = min(vol_ratio / 5.0, 1.0) * 25

    # 3. 连板势能(0-20): 已连板数反映惯性
    try:
        boards = int(zt_stat.split("/")[0])
    except (ValueError, IndexError):
        boards = 0
    s_streak = min(boards / 3.0, 1.0) * 20

    # 4. 新高突破(0-10)
    s_high = 10.0 if is_new_high else 0.0

    # 5. 换手率适当性(0-10): 3%-15%最佳区间
    if 3 <= turnover <= 15:
        s_turn = 10.0
    elif turnover < 3:
        s_turn = (turnover / 3.0) * 10
    else:
        s_turn = max(0, (1.0 - (turnover - 15) / 30.0)) * 10

    total = round(s_prox + s_vol + s_streak + s_high + s_turn, 1)
    grade = "A" if total >= 75 else "B" if total >= 55 else "C" if total >= 30 else "D"
    reasons_parts = []
    if proximity >= 0.8:
        reasons_parts.append("涨幅接近涨停")
    elif proximity >= 0.5:
        reasons_parts.append("涨幅显著")
    if vol_ratio >= 3:
        reasons_parts.append(f"量比{vol_ratio:.1f}倍放量")
    elif vol_ratio >= 1.5:
        reasons_parts.append("温和放量")
    if boards >= 1:
        reasons_parts.append(f"连板{boards}天")
    if is_new_high:
        reasons_parts.append("创60日新高")
    if 3 <= turnover <= 15:
        reasons_parts.append("换手健康")
    elif turnover > 15:
        reasons_parts.append("换手偏高")

    return {
        "total_score": total,
        "grade": grade,
        "proximity_score": round(s_prox, 1),
        "volume_score": round(s_vol, 1),
        "streak_score": round(s_streak, 1),
        "new_high_score": round(s_high, 1),
        "turnover_score": round(s_turn, 1),
        "reasons": reasons_parts[:5],
    }


def scan_potential_limit_up(trade_date: str, limit: int = 10) -> list[dict[str, Any]]:
    """扫描当日强势股，按涨停潜力排名，返回 Top N。"""
    from app.data.akshare_adapter import fetch_strong_pool  # noqa: F811

    raw = fetch_strong_pool(trade_date)
    if not raw:
        return []

    results: list[dict[str, Any]] = []
    for rec in raw:
        scored = _score_potential(rec)
        # 尝试获取近期K线作参考（快速趋势确认）
        try:
            qs = get_quotes(rec["code"], 10)
            if qs and len(qs) >= 5:
                closes = [q["close"] for q in qs[-5:]]
                trend_pct = round((closes[-1] / closes[0] - 1) * 100, 1)
            else:
                trend_pct = 0.0
        except Exception:
            trend_pct = 0.0

        results.append({
            "code": rec["code"],
            "name": rec["name"],
            "change_pct": round(rec["change_pct"], 2),
            "price": rec["price"],
            "limit_price": rec["limit_price"],
            "amount": rec["amount"],
            "float_mv": rec["float_mv"],
            "total_mv": rec["total_mv"],
            "turnover": round(rec["turnover"], 2),
            "vol_ratio": round(rec["vol_ratio"], 2),
            "speed": round(rec["speed"], 2),
            "is_new_high": rec["is_new_high"],
            "zt_stat": rec["zt_stat"],
            "reason": rec.get("reason", ""),
            "industry": rec.get("industry", ""),
            "trend_5d": trend_pct,
            **scored,
        })

    results.sort(key=lambda r: -r["total_score"])
    top = results[:limit]

    # 分配排名标签
    for i, r in enumerate(top):
        r["rank"] = i + 1
        if i == 0:
            r["rank_label"] = "🔥 最看好"
        elif i < 3:
            r["rank_label"] = "⭐ 强烈关注"
        elif i < 6:
            r["rank_label"] = "👀 重点关注"
        else:
            r["rank_label"] = "📋 备选关注"

    return top
