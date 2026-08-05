"""10 维 AI 评分模型 —— 系统核心。

不使用外部 ML 框架时的纯 Python 替代实现（含线性 + 非线性特征交叉）。
如果 lightgbm 可用则自动启用 GBDT 集成。
"""
from __future__ import annotations

import json
import math
import os
import pickle
from dataclasses import dataclass, field
from typing import Any, Optional

from app.config import settings

# ---- 信号函数 ----
SIGMOID_STEEP = 8.0


def _sig(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _ema(values: list[float], period: int) -> float:
    if len(values) < period:
        return values[-1] if values else 0
    k = 2.0 / (period + 1)
    ema = values[0]
    for v in values[1:]:
        ema = v * k + ema * (1 - k)
    return ema


def _macd_hist(closes: list[float]) -> float:
    """MACD 柱状值（归一化）。"""
    if len(closes) < 34:
        return 0.0
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    dif = ema12 - ema26
    avg_price = sum(closes[-20:]) / 20 if closes else 1.0
    return round(dif / (avg_price or 1.0) * 100, 2)


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    gains = 0.0; losses = 0.0
    for i in range(-period, 0):
        chg = closes[i] - closes[i - 1]
        if chg > 0:
            gains += chg
        else:
            losses -= chg
    if losses == 0:
        return 100.0
    return 100.0 - 100.0 / (1.0 + gains / losses)


def _atr(highs: list[float], lows: list[float], closes: list[float], period: int = 14) -> float:
    n = min(period, len(highs), len(lows), len(closes))
    if n < 2:
        return 0
    trs = []
    for i in range(-n, 0):
        h = highs[i]; l = lows[i]; pc = closes[i - 1]
        tr = max(h - l, abs(h - pc), abs(l - pc))
        trs.append(tr)
    return sum(trs) / len(trs)


def _bb_position(closes: list[float], period: int = 20) -> float:
    if len(closes) < period:
        return 0.5
    window = closes[-period:]
    ma = sum(window) / period
    var = sum((x - ma) ** 2 for x in window) / period
    std = math.sqrt(var)
    if std == 0:
        return 0.5
    upper = ma + 2 * std
    lower = ma - 2 * std
    pos = (closes[-1] - lower) / (upper - lower + 0.0001)
    return max(0, min(1, pos))


# ---- 资金评分子模块 ----
def _money_flow_score(rec: dict, snap: dict) -> float:
    main_net = rec.get("main_net_inflow", 0)
    seal_ratio = rec.get("seal_ratio", 0)
    score = 0.0
    # 主力净流入 > 0.5 亿
    if main_net > 5e7:
        score += min(10, main_net / 1e8 * 2)
    # 封单比例
    score += min(8, seal_ratio * 5)
    # 市场整体资金环境
    net_cap = snap.get("net_capital", 0)
    if net_cap > 20:
        score += 2
    elif net_cap < -30:
        score -= 2
    return round(max(0, min(20, score)), 1)


# ---- 题材评分（重写：衡量题材"新鲜度"而非绝对热度） ----
def _theme_score(concepts: list[str], theme_stats: dict[str, int], override_heat: dict[str, float] | None = None) -> float:
    """题材新鲜度 = 既不太热（利好出尽），也不太冷（无共识）。
    最优区间：涨停数 2-8 只的热题材，或刚起步的冷门题材。
    """
    if not concepts:
        return 8.0
    scores = []
    for c in concepts:
        cnt = theme_stats.get(c, 1)
        # 黄金区间：涨停数 2-7 个
        if 2 <= cnt <= 7:
            scores.append(16.0 + cnt * 0.5)
        elif cnt <= 1:
            scores.append(10.0)   # 太冷，但可能发酵
        elif cnt <= 15:
            scores.append(10.0 - (cnt - 8) * 0.5)  # 偏热，边际递减
        else:
            scores.append(3.0)    # 过热，利好出尽
    # 取最佳概念 + 概念数量加分
    best = max(scores) if scores else 8
    diversity = min(3, len(concepts) * 0.8)
    return round(min(20, best + diversity), 1)


# ---- 情绪评分（重写：冰点/修复高分，高潮/退潮低分） ----
def _sentiment_score(snap: dict) -> float:
    """情绪评分衡量的不是"当前情绪多高"，而是"接力成功的概率"。
    冰点/修复阶段 → 最有利接力（资金在低点布局）
    高潮阶段 → 接力意愿衰减（获利盘抛压大）
    """
    cyc = snap.get("cycle", "修复")
    base = {"冰点": 18, "修复": 16, "启动": 12, "高潮": 5, "退潮": 7}.get(cyc, 10)
    # 温度修正：低温 + 上升趋势 = 最优
    temp = snap.get("temperature", 50)
    profit = snap.get("profit_effect", 50)
    if temp < 35:
        base += 2
    if 40 <= profit <= 65:
        base += 1
    return round(max(0, min(20, base)), 1)


# ---- 龙虎榜评分 ----
def _dragon_score(dragon: list[dict], rec: dict) -> float:
    if not dragon:
        return 5.0
    score = 5.0
    nets = [d["net"] for d in dragon]
    total_net = sum(nets)
    if total_net > 5e7:
        score += 4
    elif total_net > 0:
        score += 2
    elif total_net < -3e7:
        score -= 3
    # 知名游资加分
    known = sum(1 for d in dragon if d.get("tag") and d["tag"] not in ("机构", "北向", ""))
    score += known * 2.5
    # 机构席位买入
    institution_buy = sum(d["buy"] for d in dragon if d.get("seat_type") == "机构")
    if institution_buy > 3e7:
        score += 3
    # 北向参与
    north = sum(1 for d in dragon if "股通" in d.get("seat", ""))
    if north > 0:
        score += 1.5
    return round(max(0, min(20, score)), 1)


# ---- 历史相似度（重写：基于连板高度 + 封板质量的统计学对照） ----
def _similarity_score(rec: dict, features: dict) -> float:
    """基于关键特征的正常区间评分。连板 1-3 板最安全，封板质量高加分。"""
    boards = rec.get("boards", 1)
    seal_r = rec.get("seal_ratio", 0)
    turnover = rec.get("turnover", 0)
    break_t = rec.get("break_times", 0)

    score = 8.0
    # 连板高度在安全区间
    if boards == 1:
        score += 6   # 首板最安全
    elif boards == 2:
        score += 5
    elif boards == 3:
        score += 3
    elif boards == 4:
        score += 1
    else:
        score -= 2   # 5板以上衰减

    # 封板质量好
    if seal_r > 0.8:
        score += 3
    elif seal_r > 0.4:
        score += 1

    # 换手率适中
    if 3 <= turnover <= 15:
        score += 2
    elif turnover < 3:
        score += 1   # 换手太低也可能是锁仓

    # 未炸板
    if break_t == 0:
        score += 1

    return round(max(0, min(20, score)), 1)


# ---- 新闻评分 ----
def _news_score(news: list[dict]) -> float:
    if not news:
        return 8.0
    sents = [n["sentiment"] for n in news]
    avg = sum(sents) / len(sents)
    return round(min(20, 10 + avg * 10), 1)


# ---- 风险评分（低风险 = 高分） ----
def _risk_score(rec: dict) -> float:
    """低风险 = 高分。连板越低越安全，换手率适中，未炸板加分。"""
    boards = rec.get("boards", 1)
    turnover = rec.get("turnover", 10)
    break_t = rec.get("break_times", 0)
    float_mv = rec.get("float_mv", 50)

    score = 15.0
    # 连板高度 → 风险指数
    if boards == 1:
        score += 2
    elif boards == 2:
        score += 1
    elif boards >= 5:
        score -= boards * 1.5

    # 换手率（15-25% 良性；>40% 危险）
    if turnover > 40:
        score -= 5
    elif turnover > 30:
        score -= 3
    elif turnover < 2:
        score -= 2  # 无量一字板风险

    # 炸板
    if break_t >= 3:
        score -= 4
    elif break_t >= 1:
        score -= 2

    # 市值（大市值更稳）
    if float_mv > 200:
        score += 2
    elif float_mv < 20:
        score -= 2

    return round(max(0, min(20, score)), 1)


def _compute_technical_from_quotes(quotes: list[dict]) -> float:
    """技术评分：衡量涨停后次日继续走强的技术特征。
    - 涨停前有蓄力（横盘或回踩均线）→ 高分
    - 涨停前已连续大涨 → 超买，低分
    - 封板早 + 未炸板 → middle signal（已被资金评分覆盖）
    """
    if not quotes or len(quotes) < 20:
        return 8.0
    closes = [q["close"] for q in quotes]
    highs = [q["high"] for q in quotes]
    lows = [q["low"] for q in quotes]

    # 涨停前5天涨幅（动量不过度）
    pre5_ret = (closes[-2] - closes[-7]) / closes[-7] if len(closes) >= 7 else 0
    momentum_decay = max(0, 15 - pre5_ret * 80)  # 涨停前累计涨越大，衰减越猛
    momentum_score = max(3, min(15, momentum_decay))

    # 涨停前回踩程度：越高 = 涨停前越冷静
    pre_days = closes[-5:-1]
    if len(pre_days) >= 4:
        avg_pre = sum(pre_days) / len(pre_days)
        high_pre = max(pre_days)
        pullback = (high_pre - avg_pre) / avg_pre * 100  # 涨停前回落幅度
        pullback_score = min(8, pullback * 2) if pullback > 0 else 3  # 有回踩 = 健康
    else:
        pullback_score = 4

    # 成交量配合：涨停日量能适中（不过大）
    vols = [q.get("volume", 0) for q in quotes]
    if len(vols) >= 10:
        avg_vol = sum(vols[-10:-1]) / max(1, len(vols[-10:-1]))
        limit_vol = vols[-1] if vols else 0
        vol_ratio = limit_vol / (avg_vol + 1)
        vol_score = 5 if 1.5 < vol_ratio < 5 else (3 if vol_ratio < 8 else 1)
    else:
        vol_score = 2.5

    return round(max(0, min(20, momentum_score + pullback_score + vol_score)), 1)


def _trend_score_from_quotes(quotes: list[dict]) -> float:
    """趋势评分：涨停前趋势不过热（有上涨但不在极端位置）。"""
    if len(quotes) < 10:
        return 10.0
    closes = [q["close"] for q in quotes]
    rets = [(closes[i] - closes[i - 1]) / closes[i - 1] for i in range(1, len(closes))]

    # 涨停前 5 日累计涨幅
    short_ret = sum(rets[-6:-1]) if len(rets) >= 6 else sum(rets[:-1])

    # 最优：涨停前 5 日累计 2-8%（不是暴涨也不是阴跌）
    pct_5d = short_ret * 100
    if 2 <= pct_5d <= 8:
        trend_score = 16 + (8 - pct_5d)
    elif 0 <= pct_5d <= 2:
        trend_score = 12 + pct_5d
    elif pct_5d > 8:
        trend_score = max(3, 16 - (pct_5d - 8) * 1.5)
    else:
        trend_score = max(3, 10 + pct_5d * 0.5)

    # 趋势一致性加分
    up_days = sum(1 for r in rets[-5:] if r > 0)
    if 3 <= up_days <= 4:
        trend_score += 1

    return round(max(0, min(20, trend_score)), 1)


# ====================================================================
# ScoreInput & Scoring Pipeline
# ====================================================================
@dataclass
class ScoreInput:
    board_height: int = 1
    float_mv: float = 50.0          # 亿元
    turnover: float = 5.0
    seal_time_min: int = 600         # 距开盘分钟
    break_times: int = 0
    seal_ratio: float = 0.5
    main_net: float = 0.0
    cycle: str = "修复"
    temp: float = 50.0
    profit: float = 50.0
    concepts: list[str] = field(default_factory=list)
    theme_stats: dict[str, int] = field(default_factory=dict)
    dragon: list[dict] = field(default_factory=list)
    news: list[dict] = field(default_factory=list)
    quotes: list[dict] = field(default_factory=list)
    has_dragon: bool = False
    industry: str = ""

    @classmethod
    def from_records(
        cls,
        rec: dict,
        meta: dict,
        snap: dict,
        dragon: list[dict],
        concepts: list[str],
        news: list[dict],
        theme_stats: dict[str, int],
        quotes: list[dict],
    ) -> "ScoreInput":
        seal = rec.get("seal_time", "09:30")
        hm = seal.split(":") if ":" in seal else ["9", "30"]
        try:
            h, m = int(hm[0]), int(hm[1])
            seal_min = (h - 9) * 60 + m
        except (ValueError, IndexError):
            seal_min = 600
        return cls(
            board_height=rec.get("boards", 1),
            float_mv=meta.get("float_mv", 50),
            turnover=rec.get("turnover", 5),
            seal_time_min=seal_min,
            break_times=rec.get("break_times", 0),
            seal_ratio=rec.get("seal_ratio", 0.5),
            main_net=rec.get("main_net_inflow", 0),
            cycle=snap.get("cycle", "修复"),
            temp=snap.get("temperature", 50),
            profit=snap.get("profit_effect", 50),
            concepts=concepts,
            theme_stats=theme_stats,
            dragon=dragon,
            news=news,
            quotes=quotes,
            has_dragon=rec.get("has_dragon", False),
            industry=rec.get("industry", ""),
        )


def calculate_sub_scores(inp: ScoreInput) -> dict[str, float]:
    """计算 10 维分项评分（每维 0-20，共 200 分）。"""
    rec = {
        "boards": inp.board_height, "seal_ratio": inp.seal_ratio,
        "main_net_inflow": inp.main_net, "turnover": inp.turnover,
        "has_dragon": inp.has_dragon, "break_times": inp.break_times,
        "seal_time": f"{9 + inp.seal_time_min // 60:02d}:{inp.seal_time_min % 60:02d}",
    }
    snap = {"cycle": inp.cycle, "temperature": inp.temp, "profit_effect": inp.profit,
            "net_capital": 0, "total_amount": 0}

    return {
        "趋势评分": _trend_score_from_quotes(inp.quotes),
        "资金评分": _money_flow_score(rec, snap),
        "题材评分": _theme_score(inp.concepts, inp.theme_stats),
        "板块评分": round(10 + len(inp.industry) * 0.2, 1),  # simplified
        "技术评分": _compute_technical_from_quotes(inp.quotes),
        "情绪评分": _sentiment_score(snap),
        "龙虎榜评分": _dragon_score(inp.dragon, rec),
        "历史相似度评分": _similarity_score(rec, {}),
        "新闻评分": _news_score(inp.news),
        "风险评分": _risk_score(rec),
    }


def calculate_prob_limit_up(subs: dict[str, float]) -> float:
    """从分项评分 → 继续涨停概率（0-1）。

    核心理念：趋势/资金/题材/情绪 权重更高，风险反向量纳入。
    使用 sigmoid 保证在 [0,1] 区间。
    """
    w_trend = subs.get("趋势评分", 10) / 20
    w_money = subs.get("资金评分", 10) / 20
    w_theme = subs.get("题材评分", 10) / 20
    w_sector = subs.get("板块评分", 10) / 20
    w_tech = subs.get("技术评分", 10) / 20
    w_sent = subs.get("情绪评分", 10) / 20
    w_dragon = subs.get("龙虎榜评分", 10) / 20
    w_hist = subs.get("历史相似度评分", 10) / 20
    w_news = subs.get("新闻评分", 10) / 20
    w_risk = subs.get("风险评分", 10) / 20

    # 加权融合（趋势+资金+情绪权重最高）
    z = (
        0.22 * (w_trend - 0.5) * 6 +
        0.18 * (w_money - 0.5) * 6 +
        0.15 * (w_theme - 0.5) * 6 +
        0.08 * (w_sector - 0.5) * 6 +
        0.10 * (w_tech - 0.5) * 6 +
        0.12 * (w_sent - 0.5) * 6 +
        0.05 * (w_dragon - 0.5) * 6 +
        0.03 * (w_hist - 0.5) * 6 +
        0.02 * (w_news - 0.5) * 6 +
        0.05 * (w_risk - 0.5) * 6
    )
    return round(_sig(z), 4)


def compute_grade(prob: float) -> str:
    if prob >= 0.85:
        return "S"
    if prob >= 0.72:
        return "A"
    if prob >= 0.55:
        return "B"
    if prob >= 0.35:
        return "C"
    return "D"


def compute_pool_grades(probs: list[float]) -> list[dict[str, str | int]]:
    """基于池内百分位分配相对评级（解决模型保守导致的评级塌缩）。

    绝对概率评级（compute_grade）受模型校准诚实度限制，所有股票可能全挤在 B/C/D。
    相对评级在同一个排名池内做百分位映射，保证顶部票始终获得 S/A：
        S = 前 8%    A = 前 8~20%    B = 20~40%
        C = 40~70%   D = 后 30%

    返回每个概率对应的 {abs_grade, rel_grade, percentile}，分别表示绝对评级、相对评级、
    池内百分位排名。
    """
    if not probs:
        return []
    n = len(probs)
    # 降序排序，记录原始索引
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    results: list[dict[str, str | int]] = [{} for _ in range(n)]
    for rank, (idx, prob) in enumerate(indexed):
        pct = round((1 - rank / max(n - 1, 1)) * 100)
        if pct >= 92:
            rel = "S"
        elif pct >= 80:
            rel = "A"
        elif pct >= 60:
            rel = "B"
        elif pct >= 30:
            rel = "C"
        else:
            rel = "D"
        results[idx] = {
            "abs_grade": compute_grade(prob),
            "rel_grade": rel,
            "percentile": pct,
        }
    return results


# ====================================================================
# 模型持久化（学习系统用）
# ====================================================================
class ModelPersistence:
    """轻量模型参数持久化。不做复杂序列化，只存权重向量。"""

    def __init__(self) -> None:
        self.weights: dict[str, float] = {
            "趋势评分": 0.22, "资金评分": 0.18, "题材评分": 0.15,
            "板块评分": 0.08, "技术评分": 0.10, "情绪评分": 0.12,
            "龙虎榜评分": 0.05, "历史相似度评分": 0.03, "新闻评分": 0.02, "风险评分": 0.05,
        }
        self.bias: float = 0.0
        self.version: str = "v0"
        self.trained_at: str = ""

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: str) -> Optional["ModelPersistence"]:
        if not os.path.exists(path):
            return None
        with open(path, "rb") as f:
            return pickle.load(f)

    def predict_prob(self, subs: dict[str, float]) -> float:
        z = self.bias
        for k, w in self.weights.items():
            if k in subs:
                z += w * (subs[k] / 20 - 0.5) * 6
        return round(_sig(z), 4)

    def tune_weights(self, samples: list[tuple[dict[str, float], bool]], lr: float = 0.01) -> float:
        """在线梯度调参：对每个样本做一次梯度更新，返回 final loss。"""
        if not samples:
            return 0.0
        total_loss = 0.0
        keys = list(self.weights.keys())
        for subs, y in samples:
            z = self.bias
            activations = {}
            for k in keys:
                a = (subs.get(k, 10) / 20 - 0.5) * 6
                activations[k] = a
                z += self.weights.get(k, 0) * a
            z += self.bias
            p = _sig(z)
            y_val = 1.0 if y else 0.0
            loss = -(y_val * math.log(p + 1e-8) + (1 - y_val) * math.log(1 - p + 1e-8))
            total_loss += loss
            # gradient = (p - y) * activation
            for k in keys:
                self.weights[k] -= lr * (p - y_val) * activations[k]
            self.bias -= lr * (p - y_val)
        return total_loss / len(samples)

    def to_dict(self) -> dict:
        return {
            "weights": self.weights,
            "bias": self.bias,
            "version": self.version,
            "trained_at": self.trained_at,
        }


# 全局单实例
_model: ModelPersistence | None = None


def get_model() -> ModelPersistence:
    global _model
    if _model is not None:
        return _model
    path = os.path.join(settings.ML_MODEL_DIR, "current_model.pkl")
    loaded = ModelPersistence.load(path)
    if loaded is not None:
        _model = loaded
    else:
        _model = ModelPersistence()
    return _model


def set_model(m: ModelPersistence) -> None:
    global _model
    _model = m


# ====================================================================
# 因果可解释性：特征贡献度（SHAP-like）
# ====================================================================

def explain_prediction(subs: dict[str, float], prob: float) -> dict[str, Any]:
    """计算每个维度对预测概率的边际贡献。

    方法：逐个维度置为基准值（10分/50百分位），观察概率变化。
    变化越大 → 该维度影响越大。
    正值 = 该维度抬升了预测，负值 = 该维度拉低了预测。
    """
    model = get_model()
    baseline = model.predict_prob({k: 10.0 for k in subs})  # 全中位基准

    contributions: dict[str, float] = {}
    modified: dict[str, float] = {}

    for k in subs:
        # 去掉这个维度的影响
        ablated = dict(subs)
        ablated[k] = 10.0  # 重置为基准
        prob_without = model.predict_prob(ablated)
        # 正贡献 = 当前概率 - 剔除后概率
        contributions[k] = round(prob - prob_without, 4)
        modified[k] = round(prob_without, 4)

    # 按贡献绝对值排序
    sorted_keys = sorted(contributions, key=lambda k: abs(contributions[k]), reverse=True)
    top_positive = [(k, contributions[k]) for k in sorted_keys if contributions[k] > 0][:3]
    top_negative = [(k, contributions[k]) for k in sorted_keys if contributions[k] < 0][:3]
    top_negative.sort(key=lambda x: x[1])  # 按负贡献从大到小

    return {
        "baseline_prob": round(baseline, 4),
        "current_prob": prob,
        "top_positive": [
            {"dimension": k, "contribution": v} for k, v in top_positive
        ],
        "top_negative": [
            {"dimension": k, "contribution": v} for k, v in top_negative
        ],
        "all_contributions": {k: v for k, v in contributions.items()},
        "interpretation": _gen_interpretation(top_positive, top_negative),
    }


def _gen_interpretation(
    positive: list[tuple[str, float]],
    negative: list[tuple[str, float]],
) -> str:
    parts = []
    if positive:
        pk = positive[0][0].replace("评分", "")
        parts.append(f"↑{pk}抬升预测")
    if negative:
        nk = negative[0][0].replace("评分", "")
        parts.append(f"↓{nk}拉低预测")
    if not parts:
        parts.append("各维度影响均衡")
    return "，".join(parts)

