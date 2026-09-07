// =============================================================
// 叙事赛道配置（中文标签 + 颜色）
// =============================================================
import type { NarrativeTag, TrendLabel, MoneyFlowLabel, Grade, RobinhoodStage } from "../types";

export const NARRATIVE_LABELS: Record<NarrativeTag, string> = {
  AI: "AI",
  RWA: "RWA",
  Tokenization: "代币化",
  Stablecoin: "稳定币",
  DeFi: "DeFi",
  Perp: "永续合约",
  DEX: "DEX",
  L1: "Layer 1",
  L2: "Layer 2",
  DePIN: "DePIN",
  AI_AGENT: "AI Agent",
  Meme: "Meme",
  Robinhood: "Robinhood Chain",
  BTC_ECO: "BTC 生态",
  ETH_ECO: "ETH 生态",
  SOL_ECO: "SOL 生态",
  Other: "其他",
};

export const TREND_LABELS: Record<TrendLabel, string> = {
  StrongUp: "强上升",
  Up: "上升",
  Neutral: "中性",
  Down: "下降",
  StrongDown: "强下降",
};

export const MONEY_FLOW_LABELS: Record<MoneyFlowLabel, string> = {
  StrongInflow: "强流入",
  Inflow: "流入",
  Neutral: "中性",
  Outflow: "流出",
  StrongOutflow: "强流出",
};

export const GRADE_LABELS: Record<Grade, string> = {
  S: "S 级 · 必须盯",
  A: "A 级 · 值得跟踪",
  B: "B 级 · 事件驱动",
  C: "C 级 · 删除",
};

export const ROBINHOOD_STAGE_LABELS: Record<RobinhoodStage, string> = {
  Early: "Early · 刚启动",
  Breakout: "Breakout · 突破",
  Momentum: "Momentum · 趋势确认",
  Distribution: "Distribution · 高位派发",
  Dead: "Dead · 流动性衰退",
};

/** 语义色：仅用于数据状态 */
export const SEMANTIC = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-slate-400",
  watch: "text-amber-400",
  narrative: "text-violet-400",
} as const;