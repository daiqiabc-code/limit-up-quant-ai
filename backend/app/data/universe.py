"""沪深两市股票池构造（仅上交所 + 深交所，排除港股/台股/北交所）。"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

# ---------------- 行业 -> 概念题材映射 ----------------
INDUSTRY_THEMES: dict[str, list[str]] = {
    "工业机器人": ["机器人", "人形机器人", "减速器", "工业母机", "智能制造"],
    "半导体": ["芯片", "国产替代", "先进封装", "第三代半导体", "算力"],
    "计算机设备": ["算力", "AI服务器", "液冷", "数据中心", "东数西算"],
    "软件开发": ["AI", "大模型", "数字经济", "信创", "数据要素"],
    "通信设备": ["6G", "算力", "光模块", "卫星互联网", "低空经济"],
    "医药生物": ["创新药", "CXO", "减肥药", "细胞治疗", "医疗器械"],
    "国防军工": ["军工", "商业航天", "低空经济", "军贸", "无人机"],
    "消费电子": ["消费电子", "AI手机", "折叠屏", "MR设备", "苹果链"],
    "电力设备": ["新能源", "储能", "光伏", "特高压", "固态电池"],
    "汽车零部件": ["智能驾驶", "汽车零部件", "机器人", "一体压铸", "华为链"],
    "有色金属": ["稀土", "小金属", "黄金", "铜", "资源为王"],
    "电子元件": ["PCB", "被动元件", "消费电子", "算力", "先进封装"],
    "化学制品": ["新材料", "化工", "固态电池", "碳纤维", "合成生物"],
    "传媒": ["AI应用", "游戏", "短剧", "IP经济", "虚拟人"],
    "电池": ["固态电池", "钠电池", "新能源", "储能", "锂电"],
    "航空装备": ["商业航天", "低空经济", "大飞机", "军工", "无人机"],
    "环保设备": ["环保", "循环经济", "碳中和", "污水处理"],
    "农牧饲渔": ["转基因", "农业", "猪周期", "种业"],
    "食品饮料": ["消费复苏", "预制菜", "白酒", "新消费"],
    "证券": ["券商", "金融科技", "并购重组", "牛市旗手"],
    "房地产": ["地产链", "城中村改造", "保租房"],
    "电网设备": ["特高压", "智能电网", "虚拟电厂", "配电网"],
    "专用设备": ["工业母机", "半导体设备", "锂电设备", "智能制造"],
    "光学光电子": ["MiniLED", "面板", "MR设备", "光学镜头"],
    "互联网服务": ["数字经济", "AI应用", "跨境电商", "数据要素"],
}

# 全市场重点题材（题材分析页固定跟踪）
CORE_THEMES = [
    "机器人", "AI", "算力", "芯片", "创新药", "军工",
    "消费电子", "新能源", "低空经济", "数字经济", "稀土",
    "固态电池", "商业航天", "人形机器人", "大模型", "智能驾驶",
]

_NAME_PREFIX = [
    "华", "中", "东", "南", "西", "北", "海", "天", "金", "银", "科", "德",
    "新", "宏", "长", "光", "远", "泰", "瑞", "创", "力", "晶", "联", "恒",
    "鑫", "亚", "宇", "星", "汇", "捷", "睿", "凯", "润", "拓", "昊", "锐",
]
_NAME_MID = [
    "达", "威", "康", "盛", "邦", "泰", "腾", "信", "元", "通", "特", "森",
    "利", "安", "美", "川", "翔", "驰", "越", "冠", "誉", "扬", "科", "隆",
]
_NAME_SUFFIX = [
    "科技", "股份", "电子", "智能", "精工", "材料", "装备", "光电", "动力",
    "生物", "医疗", "重工", "环境", "能源", "网络", "数据", "传感", "机电",
    "高科", "新材", "控股", "实业", "自动化", "半导",
]


@dataclass
class StockMeta:
    code: str
    name: str
    exchange: str
    board: str
    industry: str
    concepts: list[str] = field(default_factory=list)
    total_mv: float = 0.0
    float_mv: float = 0.0
    listed_days: int = 1200
    is_st: bool = False
    limit_pct: float = 10.0
    base_price: float = 10.0
    beta: float = 1.0          # 弹性：越高越容易涨停
    quality: float = 0.5       # 基本面质量 0-1


def _make_name(rnd: random.Random, used: set[str]) -> str:
    for _ in range(60):
        n = rnd.choice(_NAME_PREFIX) + rnd.choice(_NAME_MID) + rnd.choice(_NAME_SUFFIX)
        if len(n) > 4:
            n = n[:4]
        if n not in used:
            used.add(n)
            return n
    n = rnd.choice(_NAME_PREFIX) + str(rnd.randint(100, 999))
    used.add(n)
    return n


def build_universe(seed: int, size: int = 720) -> list[StockMeta]:
    """构造沪深股票池。

    代码规则遵循真实规则：
      600/601/603/605 -> 上交所主板；688 -> 科创板(20cm)
      000/001/002/003 -> 深交所主板/中小；300/301 -> 创业板(20cm)
    """
    rnd = random.Random(seed)
    used_names: set[str] = set()
    used_codes: set[str] = set()
    industries = list(INDUSTRY_THEMES.keys())
    out: list[StockMeta] = []

    board_plan = [
        ("SH", "沪市主板", ["600", "601", "603", "605"], 10.0, 0.30),
        ("SH", "科创板", ["688"], 20.0, 0.12),
        ("SZ", "深市主板", ["000", "001", "002", "003"], 10.0, 0.33),
        ("SZ", "创业板", ["300", "301"], 20.0, 0.25),
    ]

    for exchange, board, prefixes, limit_pct, share in board_plan:
        n = int(size * share)
        for _ in range(n):
            for _try in range(80):
                code = rnd.choice(prefixes) + f"{rnd.randint(0, 999):03d}"
                if code not in used_codes:
                    used_codes.add(code)
                    break
            else:
                continue
            industry = rnd.choice(industries)
            pool = INDUSTRY_THEMES[industry]
            k = rnd.randint(1, min(3, len(pool)))
            concepts = rnd.sample(pool, k)
            # 少量股票额外挂靠一个跨行业热门题材
            if rnd.random() < 0.28:
                extra = rnd.choice(CORE_THEMES)
                if extra not in concepts:
                    concepts.append(extra)

            float_mv = round(math_lognormal(rnd, 3.6, 0.85), 2)   # 亿元，中位数约 36 亿
            float_mv = max(8.0, min(float_mv, 900.0))
            total_mv = round(float_mv * rnd.uniform(1.05, 1.9), 2)
            is_st = rnd.random() < 0.025
            out.append(
                StockMeta(
                    code=code,
                    name=("ST" + _make_name(rnd, used_names)[:2]) if is_st else _make_name(rnd, used_names),
                    exchange=exchange,
                    board=board,
                    industry=industry,
                    concepts=concepts,
                    total_mv=total_mv,
                    float_mv=float_mv,
                    listed_days=rnd.randint(120, 5200),
                    is_st=is_st,
                    limit_pct=5.0 if is_st else limit_pct,
                    base_price=round(math_lognormal(rnd, 2.4, 0.6), 2),
                    beta=round(rnd.uniform(0.6, 1.8), 2),
                    quality=round(rnd.random(), 3),
                )
            )
    return out


def math_lognormal(rnd: random.Random, mu: float, sigma: float) -> float:
    import math

    return math.exp(rnd.gauss(mu, sigma))
