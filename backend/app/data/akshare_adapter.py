"""AKShare 真实行情适配器。

将东方财富/同花顺原始数据标准化为系统内部格式。
所有函数返回 list[dict] 或 dict，字段与模拟器保持一致。
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

try:
    import akshare as ak
    _AK = True
except ImportError:
    _AK = False


_NOT_AVAILABLE: dict[str, Any] = {}
_EMPTY_LIST: list[Any] = []

# 行业→概念快速映射（用于 akshare 返回的行业字段反推概念）
_INDUSTRY_CONCEPT_MAP: dict[str, list[str]] = {
    "通信设备": ["6G", "算力", "光模块", "卫星互联网", "低空经济"],
    "计算机设备": ["算力", "AI服务器", "液冷", "数据中心", "信创"],
    "软件开发": ["AI", "大模型", "数字经济", "信创", "数据要素"],
    "半导体": ["芯片", "国产替代", "先进封装", "第三代半导体", "算力"],
    "消费电子": ["消费电子", "AI手机", "折叠屏", "MR设备"],
    "汽车零部件": ["智能驾驶", "汽车零部件", "机器人", "一体压铸"],
    "通用设备": ["机器人", "工业母机", "智能制造"],
    "专用设备": ["工业母机", "半导体设备", "锂电设备"],
    "电力": ["新能源", "储能", "光伏", "特高压"],
    "电网设备": ["特高压", "智能电网", "虚拟电厂"],
    "电池": ["固态电池", "钠电池", "新能源", "储能"],
    "化学制品": ["新材料", "化工", "固态电池", "合成生物"],
    "医药生物": ["创新药", "CXO", "减肥药", "细胞治疗"],
    "国防军工": ["军工", "商业航天", "低空经济", "无人机"],
    "航空机场": ["商业航天", "低空经济", "大飞机"],
    "传媒": ["AI应用", "游戏", "短剧", "IP经济"],
    "广告营销": ["AI应用", "数字经济", "跨境电商"],
    "教育": ["AI应用", "数字教育"],
    "房地产": ["地产链", "城中村改造"],
    "有色金属": ["稀土", "小金属", "黄金", "铜"],
    "食品饮料": ["消费复苏", "预制菜", "白酒"],
    "证券": ["券商", "金融科技", "并购重组"],
    "银行": ["高股息", "价值重估"],
    "煤炭": ["高股息", "资源为王"],
    "建筑材料": ["地产链", "基建"],
    "建筑装饰": ["基建", "一带一路", "低空经济"],
    "环保": ["环保", "碳中和", "循环经济"],
    "农林牧渔": ["转基因", "农业", "种业"],
    "纺织服饰": ["消费复苏", "人民币贬值受益"],
    "家用电器": ["消费复苏", "家电补贴"],
    "电子元件": ["PCB", "被动元件", "消费电子", "算力"],
    "光学光电子": ["MiniLED", "面板", "MR设备"],
    "燃气Ⅱ": ["天然气", "能源"],
}


def is_available() -> bool:
    return _AK


def _today() -> str:
    return date.today().isoformat()


def _yesterday() -> str:
    """返回最新可用交易日（akshare 当日收盘后即有当日数据，故用今日）。"""
    return date.today().strftime("%Y%m%d")


def _guess_concepts(industry: str) -> list[str]:
    for kw, concepts in _INDUSTRY_CONCEPT_MAP.items():
        if kw in industry or industry in kw:
            return concepts
    return [industry] if industry else []


def _calc_seal_ratio(seal_amount: float, amount: float) -> float:
    if amount <= 0:
        return 0.0
    return round(min(5.0, seal_amount / amount), 2)


def _infer_limit_type(seal_time: str, turnover: float, break_times: int) -> str:
    if turnover < 1 and break_times == 0:
        return "一字板"
    if "09:25" in seal_time and turnover < 3:
        return "一字板"
    if turnover < 3 and break_times >= 1:
        return "T字板"
    return "换手板"


# ==================== 涨停池 ====================

def fetch_limit_up_pool(trade_date: str | None = None) -> list[dict[str, Any]]:
    if not _AK:
        return _EMPTY_LIST
    try:
        if trade_date is None:
            trade_date = _yesterday()
        date_fmt = trade_date.replace("-", "")
        df = ak.stock_zt_pool_em(date=date_fmt)
        if df is None or df.empty:
            return _EMPTY_LIST

        records = []
        for _, r in df.iterrows():
            code = str(r["代码"])
            seal_time = str(r.get("首次封板时间", "")).strip()
            if len(seal_time) < 4:
                seal_time = "—"
            elif len(seal_time) == 4:
                seal_time = f"{seal_time[:2]}:{seal_time[2:]}"
            elif len(seal_time) == 5 and ":" not in seal_time:
                seal_time = f"{seal_time[:2]}:{seal_time[2:]}"

            amount = float(r.get("成交额", 0))
            seal_amt = float(r.get("封板资金", 0))
            turnover = float(r.get("换手率", 0))

            records.append({
                "trade_date": trade_date,
                "code": code,
                "name": str(r["名称"]),
                "industry": str(r.get("所属行业", "")),
                "concepts": _guess_concepts(str(r.get("所属行业", ""))),
                "pct_chg": float(r.get("涨跌幅", 10)),
                "close": float(r.get("最新价", 0)),
                "boards": int(r.get("连板数", 1)),
                "amount": amount,
                "volume": 0,
                "turnover": turnover,
                "seal_time": seal_time,
                "first_seal_time": seal_time,
                "break_times": int(r.get("炸板次数", 0)),
                "seal_amount": seal_amt,
                "seal_ratio": _calc_seal_ratio(seal_amt, amount),
                "main_net_inflow": 0,
                "has_dragon": False,
                "float_mv": float(r.get("流通市值", 0)) / 1e8,
                "total_mv": float(r.get("总市值", 0)) / 1e8,
                "limit_type": _infer_limit_type(seal_time, turnover, int(r.get("炸板次数", 0))),
                "is_broken": False,
                "reason": str(r.get("涨停统计", str(r.get("所属行业", "")))),
            })
        return records
    except Exception as e:
        print(f"[AKShare] 涨停池失败: {e}")
        return _EMPTY_LIST


# ==================== 大盘快照 ====================

def fetch_market_snapshot(trade_date: str | None = None) -> dict[str, Any]:
    """获取大盘快照。避免调用 stock_zh_a_spot_em（全量 5000+ 股，代理容易拦截）。"""
    if not _AK:
        return _NOT_AVAILABLE
    try:
        t = trade_date or _yesterday()
        d8 = t.replace("-", "")

        # 1. 涨停池（核心数据，无代理问题）
        zt_df = ak.stock_zt_pool_em(date=d8)
        if zt_df is None or zt_df.empty:
            return {"trade_date": t}

        lu_all = len(zt_df)
        boards = zt_df["连板数"].tolist() if "连板数" in zt_df.columns else []
        max_boards = max(boards) if boards else 1
        consecutive = sum(1 for b in boards if b >= 2)
        amount_total = round(float(zt_df["成交额"].sum()) / 1e8, 1) if "成交额" in zt_df.columns else 0

        # 2. 涨跌家数——涨停越多→全市场越强（涨停数 × 15~25 倍大约是上涨家数）
        est_up = max(lu_all, min(4000, lu_all * 22 + 100))
        est_down = max(100, 5300 - est_up - 200)
        profit = round(est_up / 5300 * 100, 1)

        # 3. 情绪判断（基于涨停绝对数）
        if lu_all >= 70:
            cycle = "高潮"
        elif lu_all >= 45:
            cycle = "启动"
        elif lu_all <= 20:
            cycle = "冰点"
        elif lu_all <= 30:
            cycle = "退潮"
        else:
            cycle = "修复"

        # 温度 = 赚钱效应 × 0.7 + 10（确保与情绪周期一致）
        temp = round(profit * 0.7 + 10, 1)
        # 高潮阶段温度不低于55
        if cycle == "高潮":
            temp = max(temp, 55)
        elif cycle == "冰点":
            temp = min(temp, 30)

        # 4. 热点行业
        if "所属行业" in zt_df.columns:
            ind_counts = zt_df["所属行业"].value_counts().head(6)
            hot_sectors = [{"name": str(k), "heat": round(v / lu_all, 2), "limit_up_count": int(v)} for k, v in ind_counts.items()]
        else:
            hot_sectors = []

        # 5. 指数（逐个尝试，失败不阻塞）
        idx_quotes = {}
        for idx_name, idx_code in [("上证指数", "sh000001"), ("深证成指", "sz399001"), ("创业板指", "sz399006")]:
            try:
                i_df = ak.stock_zh_index_daily(symbol=idx_code)
                if i_df is not None and not i_df.empty:
                    idx_quotes[idx_name] = round(float(i_df["close"].iloc[-1]), 2)
            except Exception:
                pass

        return {
            "trade_date": t,
            "limit_up_count": lu_all,
            "limit_down_count": max(1, int(lu_all * 0.15)),
            "broken_count": 0,
            "break_rate": 0,
            "max_boards": max_boards,
            "consecutive_count": consecutive,
            "up_count": est_up,
            "down_count": est_down,
            "flat_count": max(0, 5300 - est_up - est_down),
            "sentiment_index": round(profit * 0.6 + 30, 1),
            "profit_effect": profit,
            "loss_effect": round(100 - profit, 1),
            "temperature": temp,
            "cycle": cycle,
            "total_amount": amount_total,
            "net_capital": 0,
            "north_capital": 0,
            "margin_balance": 0,
            "hot_sectors": hot_sectors,
            "index_quotes": idx_quotes,
        }
    except Exception as e:
        print(f"[AKShare] 大盘快照失败: {e}")
        import traceback; traceback.print_exc()
        return _NOT_AVAILABLE


# ==================== K线 ====================

def fetch_daily_quotes(code: str, days: int = 60) -> list[dict[str, Any]]:
    if not _AK:
        return _EMPTY_LIST
    try:
        df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
        if df is None or df.empty:
            return _EMPTY_LIST
        df = df.tail(days)
        quotes = []
        for _, r in df.iterrows():
            quotes.append({
                "code": code,
                "trade_date": str(r["日期"])[:10],
                "open": float(r["开盘"]),
                "high": float(r["最高"]),
                "low": float(r["最低"]),
                "close": float(r["收盘"]),
                "pre_close": float(r.get("前收盘", r["开盘"])),
                "volume": float(r.get("成交量", 0)),
                "amount": float(r.get("成交额", 0)),
                "pct_chg": float(r.get("涨跌幅", 0)),
                "turnover": float(r.get("换手率", 0)),
            })
        return quotes
    except Exception as e:
        print(f"[AKShare] K线获取失败 {code}: {e}")
        return _EMPTY_LIST


# ==================== 龙虎榜 ====================

def fetch_dragon_tiger(trade_date: str | None = None) -> list[dict[str, Any]]:
    if not _AK:
        return _EMPTY_LIST
    try:
        t = trade_date or _yesterday()
        d8 = t.replace("-", "")
        df = ak.stock_lhb_detail_em(date=d8)
        if df is None or df.empty:
            return _EMPTY_LIST
        records = []
        for _, r in df.iterrows():
            records.append({
                "trade_date": t,
                "code": str(r.get("代码", "")),
                "name": str(r.get("名称", "")),
                "seat": str(r.get("营业部名称", r.get("席位名称", ""))),
                "seat_type": _classify_seat(str(r.get("营业部名称", ""))),
                "tag": _seat_tag(str(r.get("营业部名称", ""))),
                "buy": float(r.get("买入额", 0)),
                "sell": float(r.get("卖出额", 0)),
                "net": float(r.get("净买入额", r.get("净额", 0))),
            })
        return records
    except Exception as e:
        print(f"[AKShare] 龙虎榜失败: {e}")
        return _EMPTY_LIST


def _classify_seat(seat_name: str) -> str:
    if "机构" in seat_name:
        return "机构"
    if "股通" in seat_name or "深股通" in seat_name or "沪股通" in seat_name:
        return "北向"
    return "游资"


def _seat_tag(seat_name: str) -> str:
    tags = ["小鳄鱼", "赵老哥", "炒股养家", "作手新一", "上塘路", "欢乐海岸", "拉萨天团", "孙哥", "方大侠"]
    for tag in tags:
        names = {
            "小鳄鱼": "太平南路", "赵老哥": "绍兴", "炒股养家": "上海分公司",
            "作手新一": "浙江分公司", "上塘路": "上塘路", "欢乐海岸": "欢乐海岸",
            "拉萨天团": "拉萨", "孙哥": "淮海中路", "方大侠": "陕西分公司",
        }
        if names.get(tag, "") in seat_name:
            return tag
    return ""


# ==================== 个股信息 ====================

def fetch_stock_meta(code: str) -> dict[str, Any] | None:
    if not _AK:
        return None
    try:
        df = ak.stock_individual_info_em(symbol=code)
        if df is None or df.empty:
            return _minimal_meta(code)
        row = dict(zip(df["item"], df["value"]))
        return {
            "code": code,
            "name": str(row.get("股票简称", code)),
            "exchange": "SH" if code.startswith(("6", "68")) else "SZ",
            "board": "科创板" if code.startswith("688") else "创业板" if code.startswith(("300", "301")) else "主板",
            "industry": str(row.get("行业", "")),
            "concepts": _guess_concepts(str(row.get("行业", ""))),
            "total_mv": _safe_float(row.get("总市值", 0)) / 1e8,
            "float_mv": _safe_float(row.get("流通市值", 0)) / 1e8,
            "listed_days": 1000,
            "is_st": "ST" in str(row.get("股票简称", "")),
            "limit_pct": 20 if code.startswith(("300", "301", "688")) else 10,
            "beta": 1.0,
            "quality": 0.5,
        }
    except Exception:
        return _minimal_meta(code)


def fetch_strong_pool(date: str) -> list[dict[str, Any]]:
    """获取当日强势股池（可能涨停/已经涨停/连板的强势标的）。"""
    import akshare as ak
    try:
        df = ak.stock_zt_pool_strong_em(date=date)
    except Exception:
        return []
    if df is None or len(df) == 0:
        return []
    records: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        records.append({
            "code": str(row["代码"]).zfill(6),
            "name": str(row["名称"]),
            "change_pct": _safe_float(row.get("涨跌幅", 0)),
            "price": _safe_float(row.get("最新价", 0)),
            "limit_price": _safe_float(row.get("涨停价", 0)),
            "amount": _safe_float(row.get("成交额", 0)),
            "float_mv": _safe_float(row.get("流通市值", 0)),
            "total_mv": _safe_float(row.get("总市值", 0)),
            "turnover": _safe_float(row.get("换手率", 0)),
            "speed": _safe_float(row.get("涨速", 0)),
            "vol_ratio": _safe_float(row.get("量比", 1.0)),
            "is_new_high": str(row.get("是否新高", "否")) == "是",
            "zt_stat": str(row.get("涨停统计", "0/0")),
            "reason": str(row.get("入选理由", "")),
            "industry": str(row.get("所属行业", "")),
        })
    return records


def _minimal_meta(code: str) -> dict[str, Any]:
    return {
        "code": code, "name": code, "exchange": "SH" if code.startswith("6") else "SZ",
        "board": "主板", "industry": "", "concepts": [],
        "total_mv": 0, "float_mv": 0, "listed_days": 1000,
        "is_st": False, "limit_pct": 10, "beta": 1.0, "quality": 0.5,
    }


def _safe_float(val: Any) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0
