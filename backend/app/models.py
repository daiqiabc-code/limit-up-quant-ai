"""ORM 数据模型。

设计要点：所有"预测"与"真实结果"分表存储且可回填，
这是 AI 学习系统能够自证有效性的基础。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Stock(Base):
    """股票基础信息（仅沪深两市）。"""

    __tablename__ = "stocks"

    code: Mapped[str] = mapped_column(String(12), primary_key=True)      # 600519
    name: Mapped[str] = mapped_column(String(32), index=True)
    exchange: Mapped[str] = mapped_column(String(8))                     # SH / SZ
    board: Mapped[str] = mapped_column(String(16))                       # 主板/创业板/科创板/北交所排除
    industry: Mapped[str] = mapped_column(String(32), index=True)
    concepts: Mapped[list] = mapped_column(JSON, default=list)
    total_mv: Mapped[float] = mapped_column(Float, default=0.0)          # 总市值（亿元）
    float_mv: Mapped[float] = mapped_column(Float, default=0.0)          # 流通市值（亿元）
    listed_days: Mapped[int] = mapped_column(Integer, default=1000)
    is_st: Mapped[bool] = mapped_column(Boolean, default=False)
    limit_pct: Mapped[float] = mapped_column(Float, default=10.0)        # 涨跌幅限制


class DailyQuote(Base):
    """日线行情，用于 K 线与技术指标。"""

    __tablename__ = "daily_quotes"
    __table_args__ = (UniqueConstraint("code", "trade_date", name="uq_quote"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(12), index=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)      # YYYY-MM-DD
    open: Mapped[float] = mapped_column(Float)
    high: Mapped[float] = mapped_column(Float)
    low: Mapped[float] = mapped_column(Float)
    close: Mapped[float] = mapped_column(Float)
    pre_close: Mapped[float] = mapped_column(Float)
    volume: Mapped[float] = mapped_column(Float)                          # 手
    amount: Mapped[float] = mapped_column(Float)                          # 元
    pct_chg: Mapped[float] = mapped_column(Float)
    turnover: Mapped[float] = mapped_column(Float, default=0.0)           # 换手率 %


class LimitUpRecord(Base):
    """某交易日的涨停快照 —— 系统的核心事实表。"""

    __tablename__ = "limit_up_records"
    __table_args__ = (
        UniqueConstraint("code", "trade_date", name="uq_limitup"),
        Index("idx_limitup_date", "trade_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)
    code: Mapped[str] = mapped_column(String(12), index=True)
    name: Mapped[str] = mapped_column(String(32))
    industry: Mapped[str] = mapped_column(String(32), default="")
    concepts: Mapped[list] = mapped_column(JSON, default=list)
    pct_chg: Mapped[float] = mapped_column(Float, default=10.0)
    close: Mapped[float] = mapped_column(Float, default=0.0)
    boards: Mapped[int] = mapped_column(Integer, default=1)               # 连板高度
    amount: Mapped[float] = mapped_column(Float, default=0.0)             # 成交额（元）
    volume: Mapped[float] = mapped_column(Float, default=0.0)
    turnover: Mapped[float] = mapped_column(Float, default=0.0)           # 换手率 %
    seal_time: Mapped[str] = mapped_column(String(8), default="")         # 封板时间 HH:MM
    first_seal_time: Mapped[str] = mapped_column(String(8), default="")
    break_times: Mapped[int] = mapped_column(Integer, default=0)          # 炸板次数
    seal_amount: Mapped[float] = mapped_column(Float, default=0.0)        # 封单金额（元）
    seal_ratio: Mapped[float] = mapped_column(Float, default=0.0)         # 封单/成交额
    main_net_inflow: Mapped[float] = mapped_column(Float, default=0.0)    # 主力净流入（元）
    has_dragon: Mapped[bool] = mapped_column(Boolean, default=False)
    float_mv: Mapped[float] = mapped_column(Float, default=0.0)           # 流通市值（亿）
    total_mv: Mapped[float] = mapped_column(Float, default=0.0)
    limit_type: Mapped[str] = mapped_column(String(16), default="换手板")  # 一字板/T字板/换手板
    is_broken: Mapped[bool] = mapped_column(Boolean, default=False)       # 当日是否最终炸板
    reason: Mapped[str] = mapped_column(String(64), default="")           # 涨停原因（题材）


class DragonTiger(Base):
    """龙虎榜席位明细。"""

    __tablename__ = "dragon_tiger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)
    code: Mapped[str] = mapped_column(String(12), index=True)
    name: Mapped[str] = mapped_column(String(32), default="")
    seat: Mapped[str] = mapped_column(String(96))                          # 席位名称
    seat_type: Mapped[str] = mapped_column(String(16))                     # 机构/游资/北向/普通
    tag: Mapped[str] = mapped_column(String(32), default="")               # 知名游资标签
    buy: Mapped[float] = mapped_column(Float, default=0.0)
    sell: Mapped[float] = mapped_column(Float, default=0.0)
    net: Mapped[float] = mapped_column(Float, default=0.0)


class MarketSnapshot(Base):
    """每日大盘情绪快照。"""

    __tablename__ = "market_snapshots"

    trade_date: Mapped[str] = mapped_column(String(10), primary_key=True)
    limit_up_count: Mapped[int] = mapped_column(Integer, default=0)
    limit_down_count: Mapped[int] = mapped_column(Integer, default=0)
    broken_count: Mapped[int] = mapped_column(Integer, default=0)
    break_rate: Mapped[float] = mapped_column(Float, default=0.0)          # 炸板率 %
    max_boards: Mapped[int] = mapped_column(Integer, default=1)
    consecutive_count: Mapped[int] = mapped_column(Integer, default=0)     # 连板数量
    up_count: Mapped[int] = mapped_column(Integer, default=0)
    down_count: Mapped[int] = mapped_column(Integer, default=0)
    flat_count: Mapped[int] = mapped_column(Integer, default=0)
    sentiment_index: Mapped[float] = mapped_column(Float, default=50.0)    # 市场情绪指数
    profit_effect: Mapped[float] = mapped_column(Float, default=50.0)      # 赚钱效应指数
    loss_effect: Mapped[float] = mapped_column(Float, default=50.0)
    temperature: Mapped[float] = mapped_column(Float, default=50.0)        # 市场温度
    cycle: Mapped[str] = mapped_column(String(8), default="修复")          # 冰点/修复/启动/高潮/退潮
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)        # 两市成交额（亿）
    net_capital: Mapped[float] = mapped_column(Float, default=0.0)         # 两市资金净流入（亿）
    north_capital: Mapped[float] = mapped_column(Float, default=0.0)       # 北向资金（亿）
    margin_balance: Mapped[float] = mapped_column(Float, default=0.0)      # 融资余额（亿）
    hot_sectors: Mapped[list] = mapped_column(JSON, default=list)
    index_quotes: Mapped[dict] = mapped_column(JSON, default=dict)


class Prediction(Base):
    """AI 预测记录 —— 学习系统的输入。

    trade_date  = 基准日（涨停发生日）
    target_date = 被预测日（下一交易日）
    """

    __tablename__ = "predictions"
    __table_args__ = (
        UniqueConstraint("code", "trade_date", "model_version", name="uq_pred"),
        Index("idx_pred_target", "target_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)
    target_date: Mapped[str] = mapped_column(String(10), index=True)
    code: Mapped[str] = mapped_column(String(12), index=True)
    name: Mapped[str] = mapped_column(String(32), default="")
    model_version: Mapped[str] = mapped_column(String(32), default="v0")

    rank: Mapped[int] = mapped_column(Integer, default=0)
    prob_limit_up: Mapped[float] = mapped_column(Float, default=0.0)       # 继续涨停概率
    prob_up: Mapped[float] = mapped_column(Float, default=0.0)             # 继续上涨概率
    prob_big_up: Mapped[float] = mapped_column(Float, default=0.0)         # 大涨(>5%)概率
    total_score: Mapped[float] = mapped_column(Float, default=0.0)         # 综合评分 0-100
    grade: Mapped[str] = mapped_column(String(8), default="C")             # AI 评级 S/A/B/C/D
    risk_level: Mapped[str] = mapped_column(String(8), default="中")       # 低/中/高/极高
    advice: Mapped[str] = mapped_column(String(32), default="观望")
    expected_return: Mapped[float] = mapped_column(Float, default=0.0)     # 预期收益 %
    expected_drawdown: Mapped[float] = mapped_column(Float, default=0.0)   # 预期回撤 %
    sub_scores: Mapped[dict] = mapped_column(JSON, default=dict)           # 10 维分项
    features: Mapped[dict] = mapped_column(JSON, default=dict)             # 原始特征（可复现）
    ai_report: Mapped[str] = mapped_column(Text, default="")               # LLM 自然语言解读
    reasons: Mapped[list] = mapped_column(JSON, default=list)              # 结构化论据
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ---- 学习系统回填字段 ----
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    actual_pct: Mapped[float] = mapped_column(Float, default=0.0)          # 次日实际涨跌幅
    actual_open_pct: Mapped[float] = mapped_column(Float, default=0.0)     # 次日竞价涨幅
    actual_limit_up: Mapped[bool] = mapped_column(Boolean, default=False)
    actual_up: Mapped[bool] = mapped_column(Boolean, default=False)
    actual_big_up: Mapped[bool] = mapped_column(Boolean, default=False)
    hit: Mapped[bool] = mapped_column(Boolean, default=False)              # 主目标是否命中
    brier: Mapped[float] = mapped_column(Float, default=0.0)               # 单样本 Brier 分数
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class ModelVersion(Base):
    """模型版本与训练元数据。"""

    __tablename__ = "model_versions"

    version: Mapped[str] = mapped_column(String(32), primary_key=True)
    algo: Mapped[str] = mapped_column(String(32), default="gbdt")
    trained_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    train_samples: Mapped[int] = mapped_column(Integer, default=0)
    test_samples: Mapped[int] = mapped_column(Integer, default=0)
    auc: Mapped[float] = mapped_column(Float, default=0.0)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0)
    precision_top10: Mapped[float] = mapped_column(Float, default=0.0)
    brier: Mapped[float] = mapped_column(Float, default=0.0)
    log_loss: Mapped[float] = mapped_column(Float, default=0.0)
    feature_importance: Mapped[dict] = mapped_column(JSON, default=dict)
    weights: Mapped[dict] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str] = mapped_column(Text, default="")


class LearningLog(Base):
    """AI 学习系统日志 —— 每一次自我验证与进化都留痕。"""

    __tablename__ = "learning_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)
    event: Mapped[str] = mapped_column(String(32))    # verify / retrain / drift / weight_tune
    level: Mapped[str] = mapped_column(String(8), default="info")
    summary: Mapped[str] = mapped_column(Text, default="")
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class NewsItem(Base):
    """新闻/公告，用于新闻评分。"""

    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_date: Mapped[str] = mapped_column(String(10), index=True)
    code: Mapped[str] = mapped_column(String(12), index=True, default="")
    title: Mapped[str] = mapped_column(String(256))
    source: Mapped[str] = mapped_column(String(32), default="")
    sentiment: Mapped[float] = mapped_column(Float, default=0.0)   # -1 ~ 1
    kind: Mapped[str] = mapped_column(String(16), default="新闻")   # 新闻/公告/研报


class AppSetting(Base):
    """键值配置（设置页热更新）。"""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
