// ============================================================
// Personal Trading OS — 统一类型定义
// 数据模型 + Provider 接口。所有模块共享，未来接入真实 API 无需重写前端。
// ============================================================

// ---------- 基础枚举 ----------
export type Side = "LONG" | "SHORT" | "FLAT";
export type Trend = "BULL" | "BEAR" | "RANGE" | "TRANSITION" | "CRASH_RISK";
export type Direction = "UP" | "DOWN" | "FLAT";
export type Action = "LONG" | "SHORT" | "WATCH" | "WAIT" | "AVOID" | "REDUCE" | "EXIT";

export type RegimeState = "BULL_TREND" | "BEAR_TREND" | "RANGE" | "TRANSITION" | "CRASH_RISK";

export type SetupStage =
  | "WAIT"
  | "BREAKOUT"
  | "PULLBACK"
  | "RESTART"
  | "ENTRY"
  | "MANAGE"
  | "EXIT"
  | "INVALIDATED";

export type SetupType =
  | "PULLBACK"
  | "BREAKOUT"
  | "RE_ENTRY"
  | "RESTART"
  | "RANGE"
  | "NONE";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type RiskStatus = "SAFE" | "CAUTION" | "WARNING" | "DANGER";
export type SystemStatus = "NORMAL" | "WARNING" | "SYSTEM_DEGRADATION" | "SYSTEM_FAILURE";
export type TradeMode = "LIVE" | "PAPER" | "TESTNET";
export type AlertType = "PRICE" | "SIGNAL" | "RISK" | "SYSTEM";
export type AlertStatus = "ACTIVE" | "TRIGGERED" | "DISMISSED";
export type MistakeType =
  | "NONE"
  | "FOMO"
  | "EARLY_ENTRY"
  | "LATE_ENTRY"
  | "OVERSIZING"
  | "NO_STOP"
  | "EARLY_EXIT"
  | "REVENGE_TRADE"
  | "OVERTRADE"
  | "RULE_VIOLATION";
export type Impact = "BULLISH" | "BEARISH" | "NEUTRAL";

// ---------- 核心实体 ----------
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface ExchangeAccount {
  exchange: string; // "OKX" | "BINANCE" | "BYBIT"
  id: string;
  name: string;
  status: "CONNECTED" | "DISCONNECTED";
  mode: TradeMode;
  equity: number;
  availableMargin: number;
  currency: string;
}

export interface Asset {
  symbol: string;
  base: string;
  quote: string;
  name: string;
  price: number;
  change24h: number; // percent
  volume24h: number;
  fundingRate: number; // percent per 8h, signed
  openInterest: number;
  high24h: number;
  low24h: number;
}

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketRegime {
  symbol: string;
  state: RegimeState;
  daily: Direction;
  h4: Direction;
  h1: Direction;
  ma80: "ABOVE" | "BELOW";
  adx: number;
  volume: "EXPANDING" | "CONTRACTING" | "NORMAL";
  volatility: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  structure: string; // "HH / HL"
  updatedAt: number;
}

export interface SignalBreakdown {
  trend: number; // /20
  structure: number; // /20
  momentum: number; // /20
  volume: number; // /15
  htfAlignment: number; // /10
  setup: number; // /10
  riskReward: number; // /5
}

export interface Signal {
  symbol: string;
  score: number; // 0..100
  breakdown: SignalBreakdown;
  trend: Trend;
  setup: SetupType;
  setupStage: SetupStage;
  action: Action;
  entry: number;
  stop: number;
  target: number;
  riskReward: number;
  risk: RiskLevel;
  reason: string;
  updatedAt: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  markPrice: number;
  sizeUsd: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  liquidation: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  riskPerTradePct: number; // 该笔若止损，损失占权益比例
  openedAt: number;
}

export interface Order {
  id: string;
  symbol: string;
  side: Side;
  type: "MARKET" | "LIMIT";
  price: number;
  size: number;
  status: "PENDING" | "FILLED" | "CANCELLED" | "REJECTED";
  expectedPrice: number;
  actualPrice: number;
  slippage: number; // percent
  fee: number;
  latencyMs: number;
  createdAt: number;
}

export interface ExecutionStats {
  avgSlippage: number; // %
  avgFee: number; // %
  avgLatencyMs: number;
  fundingCost: number;
  deviation: number; // % expected vs actual
}

export interface Trade {
  id: string;
  symbol: string;
  side: Side;
  entry: number;
  exit: number;
  stop: number;
  target: number;
  sizeUsd: number;
  leverage: number;
  regime: RegimeState;
  setup: SetupType;
  signalScore: number;
  entryReason: string;
  exitReason: string;
  result: number; // PnL amount
  rMultiple: number;
  mistake: MistakeType;
  tags: string[];
  notes: string;
  openedAt: number;
  closedAt: number;
  screenshotUrl?: string;
}

export interface JournalEntry {
  id: string;
  tradeId?: string;
  date: string; // YYYY-MM-DD
  followedSystem: boolean;
  overtraded: boolean;
  violatedRiskRules: boolean;
  enteredByFomo: boolean;
  disciplineScore: number; // 0..100
  notes: string;
}

export interface DisciplineDaily {
  date: string;
  followedSystem: boolean;
  overtraded: boolean;
  violatedRiskRules: boolean;
  enteredByFomo: boolean;
  disciplineScore: number;
}

export interface StrategyPerformance {
  id: string;
  name: string;
  symbol: string;
  trades: number;
  winRate: number; // %
  avgWinner: number; // R
  avgLoser: number; // R
  profitFactor: number;
  expectancy: number; // R
  maxDrawdown: number; // %
  byRegime: { regime: RegimeState; profitFactor: number; trades: number }[];
  verdict: string;
}

export interface AnalyticsSummary {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  avgR: number;
  sharpe: number;
  maxDrawdown: number;
  calmar: number;
  totalTrades: number;
  netPnl: number;
}

export interface RiskSnapshot {
  accountEquity: number;
  availableMargin: number;
  exposure: number; // %
  portfolioHeat: number; // %
  dailyRisk: number; // %
  weeklyRisk: number; // %
  maxDrawdown: number; // %
  currentDrawdown: number; // %
  liquidationDistance: number; // %
  status: RiskStatus;
}

export interface RiskContribution {
  symbol: string;
  heat: number; // %
  sizeUsd: number;
}

export interface SystemHealth {
  strategyStatus: "ACTIVE" | "PAUSED";
  pf30d: number;
  pf90d: number;
  currentDrawdown: number;
  ruleCompliance: number; // %
  executionQuality: number; // %
  dataQuality: number; // %
  status: SystemStatus;
  warnings: string[];
}

export interface Alert {
  id: string;
  type: AlertType;
  message: string;
  status: AlertStatus;
  severity: RiskStatus | "INFO";
  createdAt: number;
}

export interface MarketEvent {
  id: string;
  title: string;
  impact: Impact;
  confidence: number; // 0..100
  source: string;
  occurredAt: number;
}

export interface HealthMetric {
  label: string;
  value: number | string;
  status: "GOOD" | "WARN" | "BAD";
  help?: string;
}

// ---------- Aggregate ----------
export interface Opportunity extends Signal {
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  regime: MarketRegime;
  priority: number;
}

export interface TradingSnapshot {
  mode: TradeMode;
  exchange: string;
  updatedAt: number;
  assets: Record<string, Asset>;
  regime: MarketRegime;
  signals: Record<string, Signal>;
  positions: Position[];
  orders: Order[];
  risk: RiskSnapshot;
  systemHealth: SystemHealth;
  alerts: Alert[];
  marketEvents: MarketEvent[];
  analytics: AnalyticsSummary;
  strategies: StrategyPerformance[];
  executionStats: ExecutionStats;
  heatContributions: RiskContribution[];
  discipline: DisciplineDaily[];
}

// ---------- Settings (可配置参数) ----------
export interface Settings {
  riskPerTrade: number; // % 单笔风险
  maxPortfolioHeat: number; // %
  defaultLeverage: number;
  exchange: string;
  preferredTimeframe: "1H" | "4H" | "1D" | "1W";
  signalThreshold: number; // 0..100
  watchlist: string[];
  strategyParams: Record<string, number>;
  heatSafe: number;
  heatCaution: number;
  heatWarning: number;
  heatDanger: number;
}