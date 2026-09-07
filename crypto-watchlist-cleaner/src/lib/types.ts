// =============================================================
// Crypto Watchlist Cleaner — 核心类型定义
// 数据层、评分层、UI 层共用这些类型，保证层间契约清晰。
// =============================================================

/** 叙事赛道标签 */
export type NarrativeTag =
  | "AI"
  | "RWA"
  | "Tokenization"
  | "Stablecoin"
  | "DeFi"
  | "Perp"
  | "DEX"
  | "L1"
  | "L2"
  | "DePIN"
  | "AI_AGENT"
  | "Meme"
  | "Robinhood"
  | "BTC_ECO"
  | "ETH_ECO"
  | "SOL_ECO"
  | "Other";

/** 催化事件类型 */
export type CatalystType =
  | "CEX_LISTING"
  | "FUTURES"
  | "SPOT"
  | "ETF"
  | "MAINNET"
  | "UNLOCK"
  | "PRODUCT"
  | "UPGRADE"
  | "PARTNERSHIP"
  | "ECOSYSTEM"
  | "INSTITUTION";

/** 单个催化事件 */
export interface CatalystEvent {
  type: CatalystType;
  label: string; // 中文描述，如 "Binance 上线现货"
  horizon: 7 | 30 | 90; // 未来 7 / 30 / 90 天
}

/** 趋势标签 */
export type TrendLabel =
  | "StrongUp"
  | "Up"
  | "Neutral"
  | "Down"
  | "StrongDown";

/** 资金流标签 */
export type MoneyFlowLabel =
  | "StrongInflow"
  | "Inflow"
  | "Neutral"
  | "Outflow"
  | "StrongOutflow";

/** 原始币种指标（来自数据源或 Mock） */
export interface TokenRaw {
  id: string;
  symbol: string; // 例如 BTC
  name: string; // 例如 Bitcoin
  chain: string; // 链，如 Bitcoin / Ethereum / Solana / Base
  listedDays: number; // 上市天数，用于 MA 动态处理
  isMeme: boolean;
  isRobinhood: boolean; // 是否 Robinhood Chain 生态

  price: number; // USD
  marketCap: number; // USD
  fdv: number; // USD 全稀释估值
  volume24h: number; // USD

  /** 各时间窗口涨跌幅（%） */
  returnsPct: {
    d1: number; // 24H
    d7: number;
    d30: number;
    d90: number;
    ytd: number;
  };

  /** MA 相对价格偏差 (%)：(price - ma) / ma * 100 */
  maDeltaPct: {
    ma20: number;
    ma50: number;
    ma200: number;
  };

  volume: {
    avg7d: number; // USD
    avg30d: number; // USD
    changePct: number; // 24H 成交额 vs 30D 均值 (%)
    volToMc: number; // 24H 成交额 / 市值
    depth: number; // 买卖深度 0-100
  };

  holder: {
    h1: number; // 1H Holder 增长 (%)
    h6: number;
    h24: number;
    d7: number;
  };

  smartMoney: {
    netflow: number; // 标准化净流入 (-100..100)
    walletCount: number; // Smart Money 钱包数
    buySellRatio: number; // 买入/卖出比 (>1 偏多)
    newWallets: number; // 新增 Smart Money 钱包
    positionChangePct: number; // 持仓变化 (%)
  };

  narrative: {
    tags: NarrativeTag[]; // 0-3 个叙事标签
    freshness: number; // 叙事新鲜度 0-100（越高越新）
    trend: number; // 叙事热度变化 -100..100
  };

  attention: {
    base: number; // 当前热度 0-100
    growthPct: number; // 关注度增长率 (%)
    sources: {
      x?: number; // X 热度 0-100
      google?: number; // Google Trends 0-100
      social?: number; // 社媒提及 0-100
      community?: number; // Discord/Telegram 活跃 0-100
      news?: number; // 新闻数量 0-100
      exchange?: number; // 交易所搜索热度 0-100
    };
  };

  catalyst: {
    q7: number; // 未来 7 天催化评分 0-100
    q30: number; // 未来 30 天
    q90: number; // 未来 90 天
    events: CatalystEvent[];
  };

  /** Meme 专用指标 */
  meme?: {
    bundledWalletsPct: number; // 捆绑钱包占比 %
    devHoldingPct: number; // 开发者持仓 %
    devSellingPct: number; // 开发者卖出 %
    top10ConcentrationPct: number; // Top10 持币集中度 %
    lpSize: number; // LP 规模 USD
    lpChangePct: number; // LP 24H 变化 %
    sniperPct: number; // 狙击手占比 %
    freshWalletPct: number; // 新钱包占比 %
    socialAcceleration: number; // 社交加速度 -100..100
    xMentions: number; // X 提及量 (绝对值)
  };

  /** 今日状态标记 */
  addedToday?: boolean;
  removedToday?: boolean;
}

/** Kill Switch 的十项条件 */
export type KillCondition =
  | "YTD_NEGATIVE" // 条件一 YTD < 0
  | "YTD_UNDER_BTC" // 条件二 BTC YTD > 该币 YTD
  | "RS_90D_NEGATIVE" // 条件三 90D 相对强度 < 0
  | "VOLUME_DECLINING" // 条件四 成交量连续下降
  | "HOLDER_DECLINING" // 条件五 Holder Growth < 0
  | "SM_OUTFLOW" // 条件六 Smart Money 净流出
  | "NO_NEW_NARRATIVE" // 条件七 无新叙事
  | "NO_CATALYST" // 条件八 无未来催化剂
  | "MCAP_DECLINING" // 条件九 市值下降
  | "ACTIVITY_DECLINING"; // 条件十 交易活跃度明显下降

/** 七因子得分（0 - 满分） */
export interface FactorScores {
  priceStrength: number; // 0-20
  volume: number; // 0-15
  holder: number; // 0-15
  smartMoney: number; // 0-15
  narrative: number; // 0-15
  attention: number; // 0-10
  catalyst: number; // 0-10
}

/** 分级 */
export type Grade = "S" | "A" | "B" | "C";

/** 最终建议 */
export type Recommendation = "KEEP" | "WATCH" | "REMOVE";

/** AI / 规则引擎摘要 */
export interface CoinSummary {
  whyStrong: string[];
  whyWeak: string[];
  stage: string; // 当前阶段
  moneyFlow: string; // 资金是否正在进入
  worthAdding: boolean;
  risk: string; // 最大风险
  recommendation: Recommendation;
}

/** 预警 */
export interface Alert {
  id: string;
  symbol: string;
  name: string;
  level: "info" | "warn" | "critical" | "recovery";
  message: string;
  time: string; // ISO
}

/** 完整评分结果（评分层输出） */
export interface ScoredCoin extends TokenRaw {
  scores: FactorScores;
  totalScore: number; // 0-100（含惩罚前）
  penalty: number; // 额外扣分（负值）
  finalScore: number; // 0-100 最终
  rsBtc: number; // 相对 BTC 强度（组合，已归一化）
  rsBtc90d: number; // 90D 相对强度
  trend: TrendLabel;
  moneyFlow: MoneyFlowLabel;
  killCount: number; // 触发的 Kill 条件数
  killHits: KillCondition[]; // 触发的具体条件
  isRecovery: boolean; // 是否进入反转观察区
  isSCandidate: boolean; // 是否满足 S 级条件
  strongC: boolean; // 是否 Strong C
  grade: Grade;
  recommendation: Recommendation;
  removeReasons: string[]; // 中文删除原因
  memeScore?: number; // Meme 专属 0-100
  robinhoodStage?: RobinhoodStage; // Robinhood Chain 扫描阶段
  summary: CoinSummary;
  rank: number; // 市场综合排名（按 finalScore）
}

/** Robinhood Chain Meme 阶段 */
export type RobinhoodStage =
  | "Early"
  | "Breakout"
  | "Momentum"
  | "Distribution"
  | "Dead";

/** 市场整体快照 */
export interface MarketSnapshot {
  totalCoins: number;
  gradeCounts: Record<Grade, number>;
  addedToday: number;
  removedToday: number;
  riskScore: number; // 0-100
  btcTrend: TrendLabel;
  ethTrend: TrendLabel;
  totalMarketCap: number;
  btcDominance: number; // %
  marketBreadth: number; // 上涨/下跌占比 0-100
  dataUpdatedAt: string; // ISO
  isDemo: boolean; // 是否 Demo 数据
  dataSource: string; // mock | coingecko | binance | ...
}