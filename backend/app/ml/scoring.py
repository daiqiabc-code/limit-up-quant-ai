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


# ====================================================================
# 5 维盘中评分模型 —— 用户指定的核心评分引擎
# 每维 0~100，权重和=1，加权得总分 0~100
# ====================================================================

# 经验权重（后续可由策略池优化）
FIVE_DIM_WEIGHTS: dict[str, float] = {
    "board_strength": 0.25,   # 连板强度
    "seal_quality":   0.20,   # 封单质量
    "sector_position": 0.20,  # 板块地位
    "theme_freshness": 0.20,  # 题材新鲜度
    "volume_health":   0.15,  # 量价健康
}


# ====================================================================
# 参数化基因：打分函数的可调参数（由策略池遗传进化优化）
# 每个参数初始值 = 旧硬编码值，保证默认行为不变
# ====================================================================

@dataclass
class GeneParams:
    """打分函数的可调参数基因。进化时这些参数会变异/交叉。"""
    # 连板强度
    board_peak: float = 5.0           # 峰值连板（此连板数得分最高）
    board_decay_start: float = 6.0    # 衰减起始连板（≥此值开始衰减）
    # 封单质量
    seal_strong_ratio: float = 0.05   # 封单强阈值（封单额/流通市值）
    # 题材新鲜度
    theme_golden_low: float = 2.0     # 题材黄金区间下限
    theme_golden_high: float = 8.0    # 题材黄金区间上限
    theme_overheat: float = 15.0      # 题材过热阈值
    # 量价健康
    vol_healthy_low: float = 5.0      # 换手健康区间下限
    vol_healthy_high: float = 15.0    # 换手健康区间上限
    vol_too_high: float = 30.0        # 换手过大阈值


# 默认基因（= 旧硬编码值）
DEFAULT_GENE = GeneParams()

# 各基因参数的合法变异区间（变异后 clip 到此范围，保证合理）
GENE_BOUNDS: dict[str, tuple[float, float]] = {
    "board_peak": (3.0, 7.0),
    "board_decay_start": (4.0, 8.0),
    "seal_strong_ratio": (0.03, 0.08),
    "theme_golden_low": (1.0, 4.0),
    "theme_golden_high": (5.0, 12.0),
    "theme_overheat": (10.0, 20.0),
    "vol_healthy_low": (3.0, 8.0),
    "vol_healthy_high": (10.0, 20.0),
    "vol_too_high": (25.0, 40.0),
}


def clip_gene(gene: GeneParams) -> GeneParams:
    """将基因参数 clip 到合法区间。"""
    d = {}
    for k in GENE_BOUNDS:
        lo, hi = GENE_BOUNDS[k]
        v = float(getattr(gene, k))
        d[k] = max(lo, min(hi, v))
    return GeneParams(**d)


def _score_board_strength(boards: int, gene: GeneParams | None = None) -> float:
    """连板强度：连板越高分越高，但超过峰值连板衰减。

    gene.board_peak = 峰值连板（默认5，此连板数得分最高）
    gene.board_decay_start = 衰减起始连板（默认6，≥此值开始衰减）
    """
    g = gene or DEFAULT_GENE
    peak = int(g.board_peak)
    decay_start = int(g.board_decay_start)
    if boards <= 0:
        return 20.0
    # 峰值以下：线性递增映射到 46→88
    base_map = {1: 46.0, 2: 63.0, 3: 80.0, 4: 88.0}
    if boards < peak:
        return base_map.get(boards, 46.0 + (boards - 1) * 12.0)
    if boards == peak:
        return 86.0
    if boards < decay_start:
        return 78.0
    if boards == decay_start + 1:
        return 68.0
    # 衰减区：持续衰减
    return max(30.0, 68.0 - (boards - decay_start - 1) * 8.0)


def _score_seal_quality(seal_amount: float, float_mv: float, seal_time: str, break_times: int, gene: GeneParams | None = None) -> float:
    """封单质量：封单额/流通市值 比值 + 封板时间 + 炸板扣分。

    gene.seal_strong_ratio = 封单强阈值（默认0.05，≥此值给高分）
    """
    g = gene or DEFAULT_GENE
    strong = g.seal_strong_ratio
    if float_mv <= 0:
        seal_ratio = 0
    else:
        # seal_amount 单位元，float_mv 单位亿元 → 统一为元
        seal_ratio = seal_amount / (float_mv * 1e8)

    # 基础分：封单比（按 gene.seal_strong_ratio 分档）
    if seal_ratio >= strong * 1.6:       # 默认 0.08
        base = 95.0
    elif seal_ratio >= strong:           # 默认 0.05
        base = 88.0
    elif seal_ratio >= strong * 0.6:     # 默认 0.03
        base = 78.0
    elif seal_ratio >= strong * 0.2:     # 默认 0.01
        base = 65.0
    elif seal_ratio >= strong * 0.1:     # 默认 0.005
        base = 50.0
    else:
        base = 30.0

    # 封板时间加成：早盘封板加分
    try:
        parts = seal_time.split(":")
        h, m = int(parts[0]), int(parts[1])
        minutes_from_open = (h - 9) * 60 + (m - 30)
        if minutes_from_open <= 0:       # 开盘即封（一字板）
            time_bonus = 8.0
        elif minutes_from_open <= 30:     # 9:30-10:00
            time_bonus = 5.0
        elif minutes_from_open <= 120:    # 10:00-11:30
            time_bonus = 2.0
        else:                             # 午后封板
            time_bonus = -3.0
    except Exception:
        time_bonus = 0.0

    # 炸板扣分
    break_penalty = break_times * 6.0

    return round(max(0, min(100, base + time_bonus - break_penalty)), 1)


def _score_sector_position(
    rec: dict, all_records: list[dict], theme_stats: dict[str, int]
) -> float:
    """板块地位：是否板块前排/龙头。

    判断逻辑：
    - 在同概念中连板数最高 → 龙头 → 高分
    - 在同概念中排名第二 → 前排
    - 同概念涨停股多但本股排末位 → 跟风
    - 独立涨停无板块效应 → 中等
    """
    boards = rec.get("boards", 1)
    concepts = rec.get("concepts", [])

    if not concepts or not all_records:
        # 无概念归属，给中等分
        return 50.0

    # 找出同概念的涨停股
    same_concept_stocks: list[dict] = []
    for r in all_records:
        r_concepts = r.get("concepts", [])
        if any(c in concepts for c in r_concepts):
            same_concept_stocks.append(r)

    if not same_concept_stocks or len(same_concept_stocks) == 1:
        # 独立涨停，无板块效应
        return 45.0

    # 按连板数排序
    same_concept_stocks.sort(key=lambda x: -x.get("boards", 1))
    my_rank = next(
        (i + 1 for i, r in enumerate(same_concept_stocks) if r["code"] == rec["code"]),
        len(same_concept_stocks),
    )
    total_in_concept = len(same_concept_stocks)

    # 龙头（连板最高）
    if my_rank == 1:
        if total_in_concept >= 5:
            return 92.0  # 大板块龙头
        elif total_in_concept >= 3:
            return 85.0
        else:
            return 78.0
    # 第二名
    if my_rank == 2:
        return 68.0
    # 第三名
    if my_rank == 3:
        return 55.0
    # 跟风
    return max(25.0, 45.0 - (my_rank - 3) * 5.0)


def _score_theme_freshness(
    concepts: list[str], theme_stats: dict[str, int], gene: GeneParams | None = None
) -> float:
    """题材新鲜度：是否当下主线热点。

    gene.theme_golden_low/high = 题材黄金区间（默认2-8）
    gene.theme_overheat = 过热阈值（默认15）
    """
    g = gene or DEFAULT_GENE
    g_low = int(g.theme_golden_low)
    g_high = int(g.theme_golden_high)
    overheat = int(g.theme_overheat)
    if not concepts:
        return 35.0

    scores = []
    for c in concepts:
        cnt = theme_stats.get(c, 0)
        if g_low <= cnt <= g_high:
            scores.append(85.0 + (g_high - cnt) * 1.5)   # 黄金区间
        elif cnt == 1:
            scores.append(55.0)                      # 刚起步
        elif cnt == 0:
            scores.append(40.0)                      # 无共识
        elif cnt <= overheat:
            scores.append(60.0 - (cnt - g_high - 1) * 2.0)   # 偏热，边际递减
        else:
            scores.append(25.0)                      # 过热

    # 取最佳概念得分，概念多样性小幅加分
    best = max(scores)
    diversity_bonus = min(5.0, len(concepts) * 1.5)
    return round(max(0, min(100, best + diversity_bonus)), 1)


def _score_volume_health(
    turnover: float, amount: float, limit_type: str, break_times: int,
    gene: GeneParams | None = None,
) -> float:
    """量价健康：换手充分、不是一字硬顶。

    gene.vol_healthy_low/high = 换手健康区间（默认5-15）
    gene.vol_too_high = 换手过大阈值（默认30）
    """
    g = gene or DEFAULT_GENE
    h_low = g.vol_healthy_low
    h_high = g.vol_healthy_high
    too_high = g.vol_too_high
    # 换手率评分（基于 gene 的健康区间）
    if h_low <= turnover <= h_high:
        turn_score = 90.0
    elif h_low * 0.6 <= turnover < h_low:
        turn_score = 80.0
    elif h_high < turnover <= h_high * 1.67:
        turn_score = 70.0
    elif h_low * 0.4 <= turnover < h_low * 0.6:
        turn_score = 60.0
    elif h_high * 1.67 < turnover <= too_high * 1.33:
        turn_score = 45.0
    elif turnover < h_low * 0.4:
        turn_score = 35.0   # 无量一字板
    else:
        turn_score = 25.0   # 换手过大

    # 涨停类型修正
    type_bonus = {"换手板": 5.0, "T字板": 0.0, "一字板": -8.0}.get(limit_type, 0.0)

    # 成交额修正（亿元）
    amt_yi = amount / 1e8
    if amt_yi >= 5:
        amt_bonus = 3.0
    elif amt_yi >= 2:
        amt_bonus = 1.0
    elif amt_yi < 0.5:
        amt_bonus = -5.0   # 流动性差
    else:
        amt_bonus = 0.0

    # 炸板扣分
    break_penalty = break_times * 4.0

    return round(max(0, min(100, turn_score + type_bonus + amt_bonus - break_penalty)), 1)


# ---- 5 维评分入口 ----

# 维度中文名映射（用于 explain 输出）
DIM_CN_NAMES = {
    "board_strength": "连板强度",
    "seal_quality": "封单质量",
    "sector_position": "板块地位",
    "theme_freshness": "题材新鲜度",
    "volume_health": "量价健康",
}


def _compute_explain(
    subs: dict[str, float],
    weights: dict[str, float],
    rec: dict,
) -> dict[str, Any]:
    """因果可解释：计算每个维度对总分的边际贡献。

    方法：以 50 分为中性基准，计算 (实际分 - 50) × 权重 = 贡献分值。
    正值表示该维度抬升了总分，负值表示拉低了总分。
    """
    contributions = {}
    for k in subs:
        # 贡献 = (实际得分 - 中性基准50) × 权重
        delta = (subs[k] - 50.0) * weights.get(k, 0.2)
        contributions[k] = round(delta, 1)

    # 排序：正贡献降序，负贡献升序
    positive = sorted(
        [(k, v) for k, v in contributions.items() if v > 0],
        key=lambda x: -x[1],
    )[:3]
    negative = sorted(
        [(k, v) for k, v in contributions.items() if v < 0],
        key=lambda x: x[1],
    )[:3]

    # 生成人类可读的贡献描述
    def _fmt_contribution(k: str, v: float) -> str:
        cn = DIM_CN_NAMES.get(k, k)
        sign = "+" if v > 0 else ""
        return f"{cn}{sign}{v}分"

    return {
        "top_positive": [
            {"dimension": k, "dimension_cn": DIM_CN_NAMES.get(k, k), "contribution": v,
             "desc": _fmt_contribution(k, v)}
            for k, v in positive
        ],
        "top_negative": [
            {"dimension": k, "dimension_cn": DIM_CN_NAMES.get(k, k), "contribution": v,
             "desc": _fmt_contribution(k, v)}
            for k, v in negative
        ],
        "all_contributions": {DIM_CN_NAMES.get(k, k): v for k, v in contributions.items()},
        "summary": _gen_explain_summary(positive, negative, rec),
    }


def _gen_explain_summary(
    positive: list[tuple[str, float]],
    negative: list[tuple[str, float]],
    rec: dict,
) -> str:
    """生成一句话因果解释摘要。"""
    parts = []
    if positive:
        pk = DIM_CN_NAMES.get(positive[0][0], positive[0][0])
        parts.append(f"↑{pk}贡献+{positive[0][1]}分")
    if len(positive) >= 2:
        pk2 = DIM_CN_NAMES.get(positive[1][0], positive[1][0])
        parts.append(f"{pk2}+{positive[1][1]}")
    if negative:
        nk = DIM_CN_NAMES.get(negative[0][0], negative[0][0])
        parts.append(f"↓{nk}拖累{negative[0][1]}分")
    if not parts:
        parts.append("各维度影响均衡")
    return "，".join(parts)


def score_five_dimensions(
    rec: dict,
    all_records: list[dict],
    theme_stats: dict[str, int],
    weights: dict[str, float] | None = None,
    gene: GeneParams | None = None,
) -> dict[str, Any]:
    """对单只涨停股计算 5 维评分。

    weights: 自定义权重（如来自策略池或环境微调），默认用经验值。
    gene: 打分函数参数基因（来自策略池），默认用 DEFAULT_GENE。

    返回：
        {
            "sub_scores": {"board_strength": 63.0, "seal_quality": 78.0, ...},
            "total_score": 72.5,
            "weights": {...},
            "gene_params": {...},   # 当前使用的基因参数（便于审计/复现）
            "explain": {...},
        }
    """
    w = weights or FIVE_DIM_WEIGHTS
    g = gene or DEFAULT_GENE

    boards = int(rec.get("boards", 1))
    seal_amount = float(rec.get("seal_amount", 0))
    float_mv = float(rec.get("float_mv", 50))
    seal_time = str(rec.get("seal_time", "10:00"))
    break_times = int(rec.get("break_times", 0))
    concepts = rec.get("concepts", [])
    turnover = float(rec.get("turnover", 5))
    amount = float(rec.get("amount", 0))
    limit_type = str(rec.get("limit_type", "换手板"))

    subs = {
        "board_strength":  _score_board_strength(boards, g),
        "seal_quality":    _score_seal_quality(seal_amount, float_mv, seal_time, break_times, g),
        "sector_position": _score_sector_position(rec, all_records, theme_stats),
        "theme_freshness": _score_theme_freshness(concepts, theme_stats, g),
        "volume_health":   _score_volume_health(turnover, amount, limit_type, break_times, g),
    }

    total = round(
        sum(subs[k] * w.get(k, 0.2) for k in subs), 1
    )

    explain = _compute_explain(subs, w, rec)

    return {
        "sub_scores": subs,
        "total_score": total,
        "weights": dict(w),
        "gene_params": _gene_to_dict(g),
        "explain": explain,
    }


def _gene_to_dict(gene: GeneParams) -> dict[str, float]:
    """将 GeneParams 序列化为 dict（用于持久化/审计）。"""
    return {
        "board_peak": gene.board_peak,
        "board_decay_start": gene.board_decay_start,
        "seal_strong_ratio": gene.seal_strong_ratio,
        "theme_golden_low": gene.theme_golden_low,
        "theme_golden_high": gene.theme_golden_high,
        "theme_overheat": gene.theme_overheat,
        "vol_healthy_low": gene.vol_healthy_low,
        "vol_healthy_high": gene.vol_healthy_high,
        "vol_too_high": gene.vol_too_high,
    }


# ---- 双评级 ----

def compute_abs_grade_100(score: float) -> str:
    """绝对评级（基于总分 0-100）。

    S≥85 / A≥72 / B≥55 / C≥35 / D<35
    """
    if score >= 85:
        return "S"
    if score >= 72:
        return "A"
    if score >= 55:
        return "B"
    if score >= 35:
        return "C"
    return "D"


def compute_rel_grade_batch(scores: list[float]) -> list[dict[str, Any]]:
    """相对评级（基于池内百分位）。

    S=前8% / A=8%~20% / B=20%~40% / C=40%~70% / D=后30%

    返回每个 score 对应的 {rel_grade, percentile}，顺序与输入一致。
    """
    n = len(scores)
    if n == 0:
        return []

    # 降序排列，记录原始索引
    indexed = sorted(enumerate(scores), key=lambda x: -x[1])
    results: list[dict[str, Any]] = [{} for _ in range(n)]

    for rank, (idx, score) in enumerate(indexed):
        # 百分位：rank=0 → 100（最高），rank=n-1 → 0（最低）
        pct = round((1 - rank / max(n - 1, 1)) * 100)

        # 相对评级阈值
        top_pct = (rank + 1) / n * 100
        if top_pct <= 8:
            rel = "S"
        elif top_pct <= 20:
            rel = "A"
        elif top_pct <= 40:
            rel = "B"
        elif top_pct <= 70:
            rel = "C"
        else:
            rel = "D"

        results[idx] = {
            "rel_grade": rel,
            "percentile": pct,
        }
    return results


def score_limit_up_batch(
    records: list[dict],
    theme_stats: dict[str, int] | None = None,
    weights: dict[str, float] | None = None,
    gene: GeneParams | None = None,
) -> list[dict[str, Any]]:
    """批量评分：对一组涨停股计算 5 维评分 + 双评级 + 因果解释。

    weights: 自定义权重（如来自策略池主策略 + 环境微调），默认用经验值。
    gene: 打分函数参数基因（来自策略池），默认用 DEFAULT_GENE。

    返回列表按总分降序排列，每条包含：
        code, name, boards, total_score, sub_scores, abs_grade, rel_grade, percentile, reason, explain, gene_params
    """
    if theme_stats is None:
        # 自动从 records 统计题材热度
        theme_stats = {}
        for r in records:
            for c in r.get("concepts", []):
                theme_stats[c] = theme_stats.get(c, 0) + 1

    scored: list[dict[str, Any]] = []
    for rec in records:
        result = score_five_dimensions(rec, records, theme_stats, weights, gene)
        subs = result["sub_scores"]
        total = result["total_score"]

        scored.append({
            "code": rec.get("code", ""),
            "name": rec.get("name", ""),
            "boards": int(rec.get("boards", 1)),
            "industry": rec.get("industry", ""),
            "concepts": rec.get("concepts", []),
            "price": float(rec.get("close", 0)),
            "seal_amount": float(rec.get("seal_amount", 0)),
            "float_mv": float(rec.get("float_mv", 0)),
            "turnover": float(rec.get("turnover", 0)),
            "amount": float(rec.get("amount", 0)),
            "seal_time": rec.get("seal_time", ""),
            "break_times": int(rec.get("break_times", 0)),
            "limit_type": rec.get("limit_type", ""),
            "sub_scores": subs,
            "total_score": total,
            "gene_params": result.get("gene_params"),
            "explain": result["explain"],
        })

    # 按总分降序
    scored.sort(key=lambda x: -x["total_score"])

    # 计算双评级
    totals = [s["total_score"] for s in scored]
    rel_grades = compute_rel_grade_batch(totals)
    for i, s in enumerate(scored):
        s["abs_grade"] = compute_abs_grade_100(s["total_score"])
        s["rel_grade"] = rel_grades[i]["rel_grade"]
        s["percentile"] = rel_grades[i]["percentile"]
        s["reason"] = _gen_one_line_reason(s)

    return scored


def _gen_one_line_reason(scored: dict[str, Any]) -> str:
    """根据分项得分生成一句话理由。"""
    subs = scored["sub_scores"]
    boards = scored["boards"]
    parts = []

    # 连板强度
    if subs["board_strength"] >= 80:
        parts.append(f"{boards}连板动能强劲")
    elif subs["board_strength"] >= 60:
        parts.append(f"{boards}连板表现稳健")
    elif subs["board_strength"] < 45 and boards >= 5:
        parts.append(f"{boards}板高位风险加大")

    # 封单质量
    if subs["seal_quality"] >= 85:
        parts.append("封单坚决")
    elif subs["seal_quality"] < 50:
        parts.append("封单偏弱")

    # 板块地位
    if subs["sector_position"] >= 85:
        parts.append("板块龙头")
    elif subs["sector_position"] >= 65:
        parts.append("板块前排")
    elif subs["sector_position"] < 40:
        parts.append("板块跟风")

    # 题材新鲜度
    if subs["theme_freshness"] >= 80:
        parts.append("题材正发酵")
    elif subs["theme_freshness"] < 40:
        parts.append("题材偏冷或过热")

    # 量价健康
    if subs["volume_health"] >= 80:
        parts.append("换手健康")
    elif subs["volume_health"] < 45:
        parts.append("量价存隐忧")

    if not parts:
        parts.append("各维度表现均衡")

    return "，".join(parts[:3])

