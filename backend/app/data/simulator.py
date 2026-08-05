"""A股市场模拟器 —— 确定性伪随机 + 因果结构。

核心假设（可被真实数据覆盖）：
1. 市场情绪周期：冰点→修复→启动→高潮→退潮→冰点… 马尔可夫转移
2. 题材热度：每个题材独立演化，受整体情绪影响
3. 涨停生成：从热门题材股票中按概率抽取，考虑封板质量
4. 接力概率 = f(题材热度, 封单强度, 连板高度衰减, 情绪周期)
5. 次日收益 = 竞价溢价 + 盘中走势，均与以上因素正相关

数据用途：
- 演示模式下的 Dashboard/排行榜/详情/K线
- ML 模型训练样本（已知因果结构，可验证模型学到的东西是否正确）
- AI 学习系统验证闭环
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
from typing import Any


def _rexp(rnd: random.Random, lambd: float) -> float:
    """手动实现指数分布采样（因 random.Random 无 .exponential）。"""
    return -math.log(1.0 - rnd.random()) / lambd

from app.data.universe import CORE_THEMES, INDUSTRY_THEMES, StockMeta, build_universe

TRADING_MONTHS = 10    # 生成约 N 个月历史
DAILY_CYCLE_PROB = {
    "冰点": {"冰点": 0.12, "修复": 0.45, "启动": 0.28, "高潮": 0.10, "退潮": 0.05},
    "修复": {"冰点": 0.05, "修复": 0.25, "启动": 0.40, "高潮": 0.20, "退潮": 0.10},
    "启动": {"冰点": 0.03, "修复": 0.10, "启动": 0.30, "高潮": 0.40, "退潮": 0.17},
    "高潮": {"冰点": 0.05, "修复": 0.08, "启动": 0.12, "高潮": 0.25, "退潮": 0.50},
    "退潮": {"冰点": 0.30, "修复": 0.10, "启动": 0.05, "高潮": 0.05, "退潮": 0.50},
}

CYCLE_LIMITUP_COUNT = {"冰点": (8, 25), "修复": (15, 45), "启动": (25, 70), "高潮": (50, 120), "退潮": (10, 35)}
CYCLE_UP_RATIO = {"冰点": (0.22, 0.38), "修复": (0.33, 0.52), "启动": (0.45, 0.65), "高潮": (0.55, 0.75), "退潮": (0.28, 0.44)}
CYCLE_TEMP_RANGE = {"冰点": (0, 20), "修复": (15, 40), "启动": (30, 60), "高潮": (55, 100), "退潮": (10, 35)}

FAMOUS_SEATS = [
    ("国泰海通南京太平南路", "小鳄鱼"), ("华鑫上海分公司", "量化打板"), ("财通杭州上塘路", "上塘路"),
    ("中信上海分公司", "炒股养家"), ("银河绍兴", "赵老哥"), ("申万宏源上海东川路", ""),
    ("华泰浙江分公司", "作手新一"), ("招商深南东路", "乔帮主"), ("中信上海淮海中路", "孙哥"),
    ("东方财富拉萨团结路", "拉萨天团"), ("光大深圳金田路", ""), ("兴业陕西分公司", "方大侠"),
    ("中泰深圳欢乐海岸", "欢乐海岸"), ("国元上海虹桥路", "徐晓"), ("中信深圳", ""),
    ("机构专用", "机构"), ("深股通专用", "北向"), ("沪股通专用", "北向"),
]
NEWS_TEMPLATES = [
    "【{name}】{event}，市场关注度提升", "行业迎重磅利好，{industry}板块集体走强",
    "{name}公告：{event}", "政策推动{concept}产业加速落地", "机构调研{name}，关注{concept}布局",
]
NEWS_EVENTS = [
    "一季度业绩超预期", "获多家机构增持", "与头部企业达成战略合作",
    "技术取得重大突破", "产能扩张计划发布", "获重要资质认证",
    "回购股份用于员工持股", "子公司分拆上市", "海外市场拓展进展顺利",
]


@dataclass
class LimitUpDay:
    trade_date: str
    limit_up_records: list[dict[str, Any]] = field(default_factory=list)
    dragon_tiger: list[dict[str, Any]] = field(default_factory=list)
    news: list[dict[str, Any]] = field(default_factory=list)
    snapshot: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "trade_date": self.trade_date,
            "limit_up_records": self.limit_up_records,
            "dragon_tiger": self.dragon_tiger,
            "news": self.news,
            "snapshot": self.snapshot,
        }


def _trading_calendar(rnd: random.Random, end: date) -> list[str]:
    """生成交易日列表（跳过周末 + 固定假期）。"""
    start = end - timedelta(days=int(TRADING_MONTHS * 31))
    holidays = _build_holidays(start.year)
    out: list[str] = []
    d = start
    while d <= end:
        if d.weekday() < 5 and d.isoformat() not in holidays:
            out.append(d.isoformat())
        d += timedelta(days=1)
    return out


def _build_holidays(year: int) -> set[str]:
    h = set()
    for y in (year - 1, year, year + 1):
        h.add(f"{y}-01-01"); h.add(f"{y}-01-02"); h.add(f"{y}-05-01"); h.add(f"{y}-05-02")
        h.add(f"{y}-10-01"); h.add(f"{y}-10-02"); h.add(f"{y}-10-03"); h.add(f"{y}-10-04")
    return h


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


class MarketSimulator:
    """确定性市场模拟引擎。"""

    def __init__(self, seed: int = 42, n_stocks: int = 720) -> None:
        self.rnd = random.Random(seed)
        self.seed = seed
        self.universe = build_universe(seed, n_stocks)
        self.stock_map: dict[str, StockMeta] = {s.code: s for s in self.universe}
        self.code_to_industry: dict[str, str] = {s.code: s.industry for s in self.universe}
        self.code_to_concepts: dict[str, list[str]] = {s.code: list(s.concepts) for s in self.universe}

        # 每个股票一个独立的 RNG，保持价格序列一致
        self._stock_rnd: dict[str, random.Random] = {}
        for s in self.universe:
            self._stock_rnd[s.code] = random.Random(seed + hash(s.code) % 100000)

        # 价格缓存
        self._last_prices: dict[str, float] = {}

    def generate(self) -> list[LimitUpDay]:
        end = date.today()
        all_dates = _trading_calendar(self.rnd, end)
        if len(all_dates) < 2:
            return []

        # ---- 题材热度演化全程 ----
        theme_heat: dict[str, list[float]] = self._evolve_themes(all_dates)

        # ---- 情绪周期 ----
        cycles = self._evolve_cycles(all_dates)

        # ---- 每天跑一遍 ----
        results: list[LimitUpDay] = []
        prev_limitups: list[dict[str, Any]] = []
        day_rnd = random.Random(self.seed + 777)
        prev_code_set: set[str] = set()

        for di, dt in enumerate(all_dates):
            day_rnd.seed(di * 10000 + self.seed)
            cycle = cycles[di]
            day = LimitUpDay(trade_date=dt)

            # 1. 生成涨停
            new_limits = self._gen_limit_ups(dt, cycle, theme_heat[dt], day_rnd, prev_limitups)
            day.limit_up_records = new_limits

            # 2. 生成龙虎榜
            day.dragon_tiger = self._gen_dragon_tiger(dt, new_limits, day_rnd)

            # 3. 生成新闻
            day.news = self._gen_news(dt, new_limits, theme_heat[dt], day_rnd)

            # 4. 大盘快照
            day.snapshot = self._gen_snapshot(dt, cycle, new_limits, di, all_dates, day_rnd, cycles, theme_heat)

            results.append(day)
            prev_limitups = new_limits
            prev_code_set = {r["code"] for r in new_limits}

        return results

    # ---------- 价格序列 ----------
    def gen_quotes(self, code: str, num_bars: int = 180) -> list[dict[str, Any]]:
        stock = self.stock_map.get(code)
        if not stock:
            return []
        rnd = self._stock_rnd[code]
        end = date.today()
        all_dates = _trading_calendar(rnd, end)
        if not all_dates:
            return []
        dates = all_dates[-num_bars:]
        price = stock.base_price * rnd.uniform(0.5, 2.5)
        quotes: list[dict[str, Any]] = []
        for dt in dates:
            prev_close = price
            ret = rnd.gauss(0.0002, 0.022) * stock.beta
            close = prev_close * (1 + ret)
            open_p = close * (1 + rnd.gauss(0, 0.003))
            high = close * (1 + abs(rnd.gauss(0, 0.015)))
            low = close * (1 - abs(rnd.gauss(0, 0.015)))
            high = max(high, open_p, close)
            low = min(low, open_p, close)
            vol_pct = abs(ret) * (2 + _rexp(rnd, 1.5 / stock.beta)) * 100
            float_mv = stock.float_mv * 1e8
            amount = float_mv
            volume = amount * vol_pct / 100 / (price + 0.0001)
            turnover = min(vol_pct * (1 + 2 * rnd.random()), 30.0)
            quotes.append({
                "code": code, "trade_date": dt,
                "open": round(open_p, 2), "high": round(high, 2), "low": round(low, 2),
                "close": round(close, 2), "pre_close": round(prev_close, 2),
                "volume": round(volume, 0), "amount": round(amount * vol_pct / 100, 0),
                "pct_chg": round(ret * 100, 2), "turnover": round(turnover, 2),
            })
            price = close
        self._last_prices[code] = price
        return quotes

    def get_last_price(self, code: str) -> float:
        if code not in self._last_prices:
            self.gen_quotes(code, num_bars=10)
        return self._last_prices.get(code, 10.0)

    # ---------- 内部 ----------
    def _evolve_themes(self, dates: list[str]) -> dict[str, list[float]]:
        n = len(dates)
        heat: dict[str, list[float]] = {}
        for t in CORE_THEMES:
            vals = [self.rnd.uniform(0.1, 0.5)]
            for i in range(1, n):
                d = vals[-1]
                momentum = 0.02 * (1 - d) - 0.03 * d
                shock = self.rnd.gauss(0, 0.06)
                # 每 15-30 天可能有一次脉冲
                if self.rnd.random() < 0.04:
                    shock += 0.15 * self.rnd.random()
                vals.append(max(0.01, min(0.99, d + momentum + shock)))
            heat[t] = vals
        # 转成按日期索引
        by_date: dict[str, list[float]] = {}
        for i, dt in enumerate(dates):
            by_date[dt] = [heat[t][i] for t in CORE_THEMES]
        return by_date

    def _theme_index(self, theme_heats: list[float]) -> dict[str, float]:
        return {t: h for t, h in zip(CORE_THEMES, theme_heats)}

    def _evolve_cycles(self, dates: list[str]) -> list[str]:
        cycles = ["修复"]
        for _ in range(1, len(dates)):
            prev = cycles[-1]
            probs = DAILY_CYCLE_PROB[prev]
            keys = list(probs.keys()); ws = list(probs.values())
            total = sum(ws)
            r = self.rnd.random() * total
            acc = 0.0
            for k, w in zip(keys, ws):
                acc += w
                if r <= acc:
                    cycles.append(k)
                    break
            else:
                cycles.append(keys[-1])
        return cycles

    def _gen_limit_ups(
        self, dt: str, cycle: str, theme_heats: list[float], rnd: random.Random,
        prev_limits: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        ti = self._theme_index(theme_heats)
        lo, hi = CYCLE_LIMITUP_COUNT[cycle]
        n_target = rnd.randint(lo, hi)
        stocks = list(self.universe)

        # 热门题材权重
        weights = []
        for s in stocks:
            w = 0.5 + sum(ti.get(c, 0) for c in s.concepts) * 2.0
            if s.beta > 1.3: w *= 1.5
            if s.is_st: w *= 0.2
            weights.append(w)
        total_w = sum(weights)
        selected: list[StockMeta] = []
        for _ in range(n_target):
            r = rnd.random() * total_w
            acc = 0.0
            for i, w in enumerate(weights):
                acc += w
                if r <= acc:
                    if stocks[i] not in selected:
                        selected.append(stocks[i])
                    break

        # 接力处理：上一个交易日的涨停股中有部分今日继续涨停
        prev_map = {r["code"]: r for r in prev_limits}
        continuation: list[dict[str, Any]] = []
        for s in list(selected):
            if s.code in prev_map:
                prev = prev_map[s.code]
                t_heat = max(ti.get(c, 0) for c in s.concepts) if s.concepts else 0.3
                seal_quality = min(1.0, prev["seal_ratio"]) if prev["seal_ratio"] > 0 else 0.5
                boards = prev.get("boards", 1)
                decay = max(0.08, 1.0 - 0.2 * (boards - 1))
                cont_prob = _sigmoid(2.5 * t_heat + 1.5 * seal_quality + 0.3 * (1 if cycle == "高潮" else -0.5) - 1.5) * decay
                if rnd.random() < cont_prob:
                    boards = boards + 1
                    seal_time = _random_seal_time(rnd, boards)
                    seal_amount = s.float_mv * 1e6 * rnd.uniform(0.3, 1.5 + 0.5 * boards)
                    amount = s.float_mv * 1e8 * rnd.uniform(0.03, 0.25)
                    main_net = amount * rnd.uniform(-0.1, 0.5)
                    continuation.append({
                        "trade_date": dt, "code": s.code, "name": s.name,
                        "industry": s.industry, "concepts": list(s.concepts),
                        "pct_chg": s.limit_pct, "close": self.get_last_price(s.code) * (1 + s.limit_pct / 100),
                        "boards": boards, "amount": round(amount, 0),
                        "volume": round(amount / (s.base_price + 0.0001), 0),
                        "turnover": round(rnd.uniform(1, 30) * (0.6 + 0.4 / boards), 2),
                        "seal_time": seal_time, "first_seal_time": seal_time,
                        "break_times": _break_times(rnd, boards, seal_time),
                        "seal_amount": round(seal_amount, 0),
                        "seal_ratio": round(min(2.0, seal_amount / (amount + 1)), 2),
                        "main_net_inflow": round(main_net, 0),
                        "has_dragon": rnd.random() < 0.4 + 0.15 * boards,
                        "float_mv": s.float_mv, "total_mv": s.total_mv,
                        "limit_type": _limit_type(rnd, boards, seal_time),
                        "is_broken": False,
                        "reason": s.concepts[0] if s.concepts else s.industry,
                    })
                    selected.remove(s)

        # 剩余为新涨停
        remaining = n_target - len(continuation)
        rnd.shuffle(selected)
        for s in selected[:remaining]:
            boards = 1 + (1 if s.code in prev_map and rnd.random() < 0.15 else 0)
            seal_time = _random_seal_time(rnd, boards)
            seal_amount = s.float_mv * 1e6 * rnd.uniform(0.2, 1.2)
            amount = s.float_mv * 1e8 * rnd.uniform(0.02, 0.2)
            main_net = amount * rnd.uniform(-0.05, 0.4)
            continuation.append({
                "trade_date": dt, "code": s.code, "name": s.name,
                "industry": s.industry, "concepts": list(s.concepts),
                "pct_chg": s.limit_pct, "close": self.get_last_price(s.code) * (1 + s.limit_pct / 100),
                "boards": boards, "amount": round(amount, 0),
                "volume": round(amount / (s.base_price + 0.0001), 0),
                "turnover": round(rnd.uniform(1, 25), 2),
                "seal_time": seal_time, "first_seal_time": seal_time,
                "break_times": _break_times(rnd, boards, seal_time),
                "seal_amount": round(seal_amount, 0),
                "seal_ratio": round(min(2.0, seal_amount / (amount + 1)), 2),
                "main_net_inflow": round(main_net, 0),
                "has_dragon": rnd.random() < 0.25,
                "float_mv": s.float_mv, "total_mv": s.total_mv,
                "limit_type": _limit_type(rnd, boards, seal_time),
                "is_broken": False,
                "reason": s.concepts[0] if s.concepts else s.industry,
            })

        return continuation[:n_target]

    def _gen_dragon_tiger(self, dt: str, limits: list[dict], rnd: random.Random) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for rec in limits:
            if not rec["has_dragon"]:
                continue
            n_seats = rnd.randint(3, 8)
            seats = rnd.sample(FAMOUS_SEATS, min(n_seats, len(FAMOUS_SEATS)))
            for seat_name, tag in seats:
                buy = rec["amount"] * rnd.uniform(0.005, 0.15) * rnd.uniform(0.8, 1.2)
                sell = buy * rnd.uniform(0, 1.3)
                stype = "机构" if "机构" in seat_name else ("北向" if "股通" in seat_name else "游资")
                rows.append({
                    "trade_date": dt, "code": rec["code"], "name": rec["name"],
                    "seat": seat_name, "seat_type": stype, "tag": tag,
                    "buy": round(buy, 0), "sell": round(sell, 0),
                    "net": round(buy - sell, 0),
                })
        return rows

    def _gen_news(self, dt: str, limits: list[dict], theme_heats: list[float], rnd: random.Random) -> list[dict[str, Any]]:
        ti = self._theme_index(theme_heats)
        rows: list[dict[str, Any]] = []
        n = rnd.randint(8, 25)
        for _ in range(n):
            rec = rnd.choice(limits) if limits and rnd.random() < 0.65 else None
            code = rec["code"] if rec else ""
            name = rec["name"] if rec else ""
            industry = rec["industry"] if rec else rnd.choice(list(INDUSTRY_THEMES))
            concepts = rec["concepts"] if rec else [rnd.choice(CORE_THEMES)]
            concept = rnd.choice(concepts) if concepts else "AI"
            tpl = rnd.choice(NEWS_TEMPLATES)
            event = rnd.choice(NEWS_EVENTS)

            # 情感分数：题材热度越强越正面
            heat_now = ti.get(concept, 0.3)
            sentiment = _sigmoid((heat_now - 0.5) * 6 + rnd.gauss(0, 0.5))
            rows.append({
                "trade_date": dt, "code": code,
                "title": tpl.format(name=name, industry=industry, concept=concept, event=event),
                "source": rnd.choice(["财联社", "同花顺", "东方财富", "证券时报", "巨潮资讯"]),
                "sentiment": round(sentiment if sentiment > 0.5 else -sentiment, 2),
                "kind": rnd.choice(["新闻", "新闻", "公告"]),
            })
        return rows

    def _gen_snapshot(
        self, dt: str, cycle: str, limits: list[dict],
        di: int, dates: list[str], rnd: random.Random,
        cycles: list[str], theme_heats: dict[str, list[float]],
    ) -> dict[str, Any]:
        total = len(self.universe)
        up_lo, up_hi = CYCLE_UP_RATIO[cycle]
        up_r = rnd.uniform(up_lo, up_hi)
        up = int(total * up_r)
        down = int(total * (1 - up_r) * rnd.uniform(0.8, 0.95))
        flat = total - up - down

        boards = [r["boards"] for r in limits]
        max_b = max(boards) if boards else 1
        consecutive = sum(1 for b in boards if b >= 2)
        break_rate = rnd.uniform(8, 35) if cycle in ("高潮", "退潮") else rnd.uniform(5, 22)
        broken = int(len(limits) * break_rate / 100)

        temp_lo, temp_hi = CYCLE_TEMP_RANGE[cycle]
        temp = rnd.uniform(temp_lo, temp_hi)

        # 赚钱效应：涨停/连板/上涨/周期 加权
        profit = min(100, max(0, temp * 0.5 + (up / total) * 40 + (consecutive / max(len(limits), 1)) * 25))
        loss = min(100, max(0, 100 - profit + rnd.uniform(-10, 10)))

        amount = rnd.uniform(4000, 18000) if cycle in ("高潮", "启动") else rnd.uniform(2500, 9000)

        nb = rnd.uniform(-30, 80) if cycle == "高潮" else rnd.uniform(-50, 30)
        nc = rnd.uniform(-60, 50)
        margin = rnd.uniform(14000, 18000)

        # 热点板块
        ti = self._theme_index(theme_heats[dt])
        sorted_themes = sorted(ti.items(), key=lambda x: -x[1])[:6]
        hot_sectors = [{"name": n, "heat": round(h, 2), "limit_up_count": rnd.randint(0, 15)} for n, h in sorted_themes]

        # 指数
        idx_base = 3100 + di * rnd.uniform(0.1, 0.5) + rnd.uniform(-15, 15)
        index_quotes = {
            "上证指数": round(idx_base, 2),
            "深证成指": round(idx_base * 3.2 + rnd.randint(-80, 80), 2),
            "创业板指": round(idx_base * 0.67 + rnd.randint(-30, 30), 2),
        }

        return {
            "trade_date": dt,
            "limit_up_count": len(limits),
            "limit_down_count": rnd.randint(0, max_b * 2 + 20),
            "broken_count": broken,
            "break_rate": round(break_rate, 1),
            "max_boards": max_b,
            "consecutive_count": consecutive,
            "up_count": up, "down_count": down, "flat_count": flat,
            "sentiment_index": round(temp, 1),
            "profit_effect": round(profit, 1),
            "loss_effect": round(loss, 1),
            "temperature": round(temp, 1),
            "cycle": cycle,
            "total_amount": round(amount, 1),
            "net_capital": round(nc, 1),
            "north_capital": round(nb, 1),
            "margin_balance": round(margin, 1),
            "hot_sectors": hot_sectors,
            "index_quotes": index_quotes,
        }


def _random_seal_time(rnd: random.Random, boards: int) -> str:
    if boards >= 4:
        t = rnd.choice([9, 10, 13])  # 高位股：早盘快速封 / 午后
    else:
        t = rnd.randint(9, 14)
    m = rnd.randint(25, 59)
    return f"{t:02d}:{m:02d}"


def _break_times(rnd: random.Random, boards: int, seal_time: str) -> int:
    if boards <= 1:
        return rnd.choices([0, 0, 1, 1, 2], weights=[50, 20, 15, 10, 5])[0]
    if boards == 2:
        return rnd.choices([0, 0, 1, 2], weights=[40, 25, 25, 10])[0]
    return rnd.choices([0, 1, 2, 3], weights=[30, 35, 20, 15])[0]


def _limit_type(rnd: random.Random, boards: int, seal_time: str) -> str:
    if boards == 1 and rnd.random() < 0.18:
        return "一字板"
    if rnd.random() < 0.08:
        return "T字板"
    return "换手板"


# ---------- 全局模拟器（进程内单例，种子上电初始化） ----------
_sim: MarketSimulator | None = None
_generated_data: list[LimitUpDay] | None = None


def get_simulator(seed: int = 42) -> MarketSimulator:
    global _sim
    if _sim is None:
        _sim = MarketSimulator(seed=seed)
    return _sim


def get_generated_data() -> list[LimitUpDay]:
    global _generated_data
    if _generated_data is None:
        _generated_data = get_simulator().generate()
    return _generated_data
