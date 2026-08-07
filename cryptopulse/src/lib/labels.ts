import type { Direction } from "@/lib/types";

export const dirColor = (d: Direction) =>
  d === "bullish" ? "#2EE6A6" : d === "bearish" ? "#FF5C7A" : "#FFB020";

export const dirLabel = (d: Direction) =>
  d === "bullish" ? "看多" : d === "bearish" ? "看空" : "中性";

export const dirTextClass = (d: Direction) =>
  d === "bullish" ? "text-bull" : d === "bearish" ? "text-bear" : "text-warn";

export const SIGNAL_CATEGORY: Record<
  string,
  { label: string; icon: string }
> = {
  "kol-resonance": { label: "KOL共振", icon: "Users" },
  "onchain-flow": { label: "链上资金", icon: "ArrowDownToLine" },
  "sentiment-surge": { label: "情绪暴涨", icon: "Flame" },
  "exchange-flow": { label: "交易所流", icon: "ArrowLeftRight" },
  "whale-accumulation": { label: "鲸鱼建仓", icon: "Fish" },
  derivative: { label: "衍生品", icon: "CandlestickChart" },
};

export const SECTOR_COLORS: Record<string, string> = {
  BTC: "#FFB020",
  ETH: "#5B9DFF",
  SOL: "#16E6C8",
  Layer2: "#A78BFA",
  DeFi: "#2EE6A6",
  Meme: "#FF5C7A",
  AI: "#5B9DFF",
  RWA: "#A78BFA",
  Stablecoin: "#9AA7BC",
  ETF: "#FFB020",
  Regulation: "#FF8A4C",
  DePIN: "#16E6C8",
};
