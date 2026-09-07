// =============================================================
// 高级过滤器配置
// 每个筛选维度的可选项集中定义，UI 直接渲染。
// =============================================================
import type { NarrativeTag, TrendLabel, MoneyFlowLabel } from "../types";
import { NARRATIVE_LABELS } from "./narratives";

export interface FilterOption {
  value: string;
  label: string;
  /** 谓词，用于过滤；返回 true 保留 */
  test: (coin: import("../types").ScoredCoin) => boolean;
}

const cap = (coin: import("../types").ScoredCoin) => coin.marketCap;

export const MARKET_CAP_FILTERS: FilterOption[] = [
  { value: "lt1m", label: "< $1M", test: (c) => cap(c) < 1_000_000 },
  {
    value: "1m-10m",
    label: "$1M – 10M",
    test: (c) => cap(c) >= 1_000_000 && cap(c) < 10_000_000,
  },
  {
    value: "10m-50m",
    label: "$10M – 50M",
    test: (c) => cap(c) >= 10_000_000 && cap(c) < 50_000_000,
  },
  {
    value: "50m-100m",
    label: "$50M – 100M",
    test: (c) => cap(c) >= 50_000_000 && cap(c) < 100_000_000,
  },
  {
    value: "100m-1b",
    label: "$100M – 1B",
    test: (c) => cap(c) >= 100_000_000 && cap(c) < 1_000_000_000,
  },
  { value: "gt1b", label: "> $1B", test: (c) => cap(c) >= 1_000_000_000 },
];

const TREND_ORDER: TrendLabel[] = [
  "StrongUp",
  "Up",
  "Neutral",
  "Down",
  "StrongDown",
];

export const TREND_FILTERS: FilterOption[] = [
  {
    value: "strong-up",
    label: "强上升",
    test: (c) => TREND_ORDER.indexOf(c.trend) <= 0,
  },
  {
    value: "up",
    label: "上升",
    test: (c) => TREND_ORDER.indexOf(c.trend) <= 1,
  },
  {
    value: "neutral",
    label: "中性",
    test: (c) => c.trend === "Neutral",
  },
  {
    value: "down",
    label: "下降",
    test: (c) => c.trend === "Down" || c.trend === "StrongDown",
  },
  {
    value: "strong-down",
    label: "强下降",
    test: (c) => c.trend === "StrongDown",
  },
];

export const YTD_FILTERS: FilterOption[] = [
  { value: "gt100", label: "> 100%", test: (c) => c.returnsPct.ytd > 100 },
  { value: "gt50", label: "> 50%", test: (c) => c.returnsPct.ytd > 50 },
  { value: "gt20", label: "> 20%", test: (c) => c.returnsPct.ytd > 20 },
  { value: "gt0", label: "> 0%", test: (c) => c.returnsPct.ytd > 0 },
  { value: "lt0", label: "< 0%", test: (c) => c.returnsPct.ytd < 0 },
];

export const VOLUME_FILTERS: FilterOption[] = [
  {
    value: "explosion",
    label: "成交量爆发",
    test: (c) => c.volume.changePct > 100,
  },
  {
    value: "increasing",
    label: "放大",
    test: (c) => c.volume.changePct > 20 && c.volume.changePct <= 100,
  },
  {
    value: "flat",
    label: "平稳",
    test: (c) => Math.abs(c.volume.changePct) <= 20,
  },
  { value: "declining", label: "萎缩", test: (c) => c.volume.changePct < -20 },
];

export const HOLDER_FILTERS: FilterOption[] = [
  { value: "rapid", label: "快速增长", test: (c) => c.holder.d7 > 15 },
  { value: "growth", label: "增长", test: (c) => c.holder.d7 > 3 },
  { value: "flat", label: "平稳", test: (c) => Math.abs(c.holder.d7) <= 3 },
  { value: "declining", label: "下降", test: (c) => c.holder.d7 < -3 },
];

const FLOW_ORDER: MoneyFlowLabel[] = [
  "StrongInflow",
  "Inflow",
  "Neutral",
  "Outflow",
  "StrongOutflow",
];

export const SMART_MONEY_FILTERS: FilterOption[] = [
  {
    value: "strong-in",
    label: "强流入",
    test: (c) => FLOW_ORDER.indexOf(c.moneyFlow) <= 0,
  },
  {
    value: "in",
    label: "流入",
    test: (c) => FLOW_ORDER.indexOf(c.moneyFlow) <= 1,
  },
  {
    value: "neutral",
    label: "中性",
    test: (c) => c.moneyFlow === "Neutral",
  },
  {
    value: "out",
    label: "流出",
    test: (c) => c.moneyFlow === "Outflow" || c.moneyFlow === "StrongOutflow",
  },
];

export const NARRATIVE_FILTERS: {
  value: NarrativeTag;
  label: string;
}[] = (
  [
    "AI",
    "RWA",
    "Tokenization",
    "Stablecoin",
    "DeFi",
    "Perp",
    "DEX",
    "L1",
    "L2",
    "DePIN",
    "AI_AGENT",
    "Meme",
    "Robinhood",
    "BTC_ECO",
    "ETH_ECO",
    "SOL_ECO",
    "Other",
  ] as NarrativeTag[]
).map((t) => ({ value: t, label: NARRATIVE_LABELS[t] }));

export const GRADE_FILTERS: {
  value: "S" | "A" | "B" | "C" | "SABC";
  label: string;
}[] = [
  { value: "S", label: "S 级" },
  { value: "A", label: "A 级" },
  { value: "B", label: "B 级" },
  { value: "C", label: "C 级" },
  { value: "SABC", label: "全部值得关注 (S/A/B)" },
];