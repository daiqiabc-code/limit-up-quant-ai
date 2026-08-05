"""AI 聊天助手路由（规则驱动兜底 + LLM 可选增强）。"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.data.provider import get_latest_trade_date, get_limit_up_data, get_market_snapshot, get_model_prediction

router = APIRouter(prefix="/api/chat", tags=["AI 聊天"])


class ChatRequest(BaseModel):
    message: str


@router.post("")
def chat(req: ChatRequest):
    msg = req.message
    date = get_latest_trade_date()
    limits = get_limit_up_data(date)
    snap = get_market_snapshot(date)

    # 简单意图路由
    if "为什么" in msg and "排第一" in msg:
        return _answer_top1(date, limits)
    if "为什么" in msg and ("高分" in msg or "低分" in msg):
        return _answer_score(date, limits)
    if "哪些" in msg and ("关注" in msg or "值得" in msg):
        return _answer_recommend(date, limits)
    if "风险" in msg:
        return _answer_risk(date, limits)
    if "情绪" in msg or "周期" in msg:
        return _answer_sentiment(snap)
    if "龙虎榜" in msg:
        return _answer_dragon(date)
    return _answer_default(date, snap, limits)


def _answer_default(date: str, snap: dict, limits: list) -> dict:
    cyc = snap.get("cycle", "—")
    temp = snap.get("temperature", 50)
    lu = snap.get("limit_up_count", 0)
    boards = snap.get("max_boards", 1)
    amt = snap.get("total_amount", 0)
    return {
        "reply": (
            f"📊 **{date} 市场概览**\n\n"
            f"• 情绪周期：**{cyc}** | 市场温度：**{temp:.1f}°**\n"
            f"• 涨停数量：**{lu}** 只 | 最高连板：**{boards}** 板\n"
            f"• 两市成交额：**{amt:.0f}** 亿\n"
            f"• 上涨家数：**{snap.get('up_count', 0)}** | 赚钱效应：**{snap.get('profit_effect', 0):.1f}**\n\n"
            f"💡 建议查看 **AI 排行榜** 获取今日接力概率排序。"
        ),
    }


def _answer_top1(date: str, limits: list) -> dict:
    if not limits:
        return {"reply": "今日暂无涨停数据。"}
    preds = [(r, get_model_prediction(date, r["code"])) for r in limits[:5]]
    preds = [(r, p) for r, p in preds if p]
    preds.sort(key=lambda x: -x[1]["prob_limit_up"])
    if not preds:
        return {"reply": "暂无评分数据。"}
    best_r, best_p = preds[0]
    subs = best_p.get("sub_scores", {})
    reasons = best_p.get("reasons", [])
    lines = [
        f"## 🥇 排名第一：{best_r['name']}({best_r['code']})",
        f"继续涨停概率：**{best_p['prob_limit_up']*100:.1f}%** | 评级：**{best_p['grade']}**",
        "",
        "**核心原因：**",
    ]
    for r in reasons:
        lines.append(f"✅ {r}")
    lines.extend([
        "",
        "**各维度评分：**",
    ])
    top_scores = sorted(subs.items(), key=lambda x: -x[1])[:5]
    for k, v in top_scores:
        lines.append(f"  {k}: **{v:.1f}**")
    return {"reply": "\n".join(lines)}


def _answer_score(date: str, limits: list) -> dict:
    return {"reply": "评分模型综合10个维度：趋势、资金、题材、板块、技术、情绪、龙虎榜、相似度、新闻、风险。你可以点击任意股票查看详情页的完整评分拆解。"}


def _answer_recommend(date: str, limits: list) -> dict:
    if not limits:
        return {"reply": "今日暂无涨停数据。"}
    preds = [(r, get_model_prediction(date, r["code"])) for r in limits]
    preds = [(r, p) for r, p in preds if p and p["grade"] in ("S", "A")]
    preds.sort(key=lambda x: -x[1]["prob_limit_up"])
    high = preds[:5]
    if not high:
        return {"reply": "当前没有 S/A 级标的，建议观望。查看 **AI 排行榜** 了解全貌。"}
    lines = ["## ⭐ 今日最值得关注的股票", ""]
    for r, p in high:
        lines.append(f"**{p['rank']}. {r['name']}({r['code']})** — {p['prob_limit_up']*100:.0f}% {p['grade']}级 {p['advice']}")
    return {"reply": "\n".join(lines)}


def _answer_risk(date: str, limits: list) -> dict:
    if not limits:
        return {"reply": "今日暂无涨停数据。"}
    preds = [(r, get_model_prediction(date, r["code"])) for r in limits]
    preds = [(r, p) for r, p in preds if p and p["risk_level"] in ("高", "极高")]
    preds.sort(key=lambda x: -x[1]["prob_limit_up"])
    high = preds[:5]
    if not high:
        return {"reply": "当前没有高风险标的。所有涨停股风险等级均为中等或偏低。"}
    lines = ["## ⚠️ 今日高风险股票", ""]
    for r, p in high:
        lines.append(f"🔴 **{r['name']}({r['code']})** — 连板{r['boards']}板 风险：{p['risk_level']}")
    return {"reply": "\n".join(lines)}


def _answer_sentiment(snap: dict) -> dict:
    return {
        "reply": (
            f"📈 **当前市场情绪**\n\n"
            f"周期：**{snap.get('cycle', '—')}**\n"
            f"温度：**{snap.get('temperature', 50):.1f}°**\n"
            f"赚钱效应：**{snap.get('profit_effect', 50):.1f}**\n"
            f"炸板率：**{snap.get('break_rate', 0):.1f}%**\n\n"
            f"涨停：{snap.get('limit_up_count', 0)} | 跌停：{snap.get('limit_down_count', 0)} | "
            f"连板：{snap.get('consecutive_count', 0)}"
        ),
    }


def _answer_dragon(date: str) -> dict:
    from app.data.provider import get_dragon_tiger
    dt = get_dragon_tiger(date)
    seats = {}
    for r in dt:
        s = r["seat"]
        if s not in seats:
            seats[s] = {"tag": r["tag"], "net": 0, "count": 0}
        seats[s]["net"] += r["net"]
        seats[s]["count"] += 1
    top = sorted(seats.items(), key=lambda x: -x[1]["net"])[:5]
    lines = ["## 🐉 龙虎榜重点席位", ""]
    for name, info in top:
        lines.append(f"**{name}**" + (f" ({info['tag']})" if info['tag'] else "") + f" — 净买入 {info['net']/1e8:.2f}亿")
    return {"reply": "\n".join(lines)}
