// ============================================================
// Coin Universe — 交易标的定义
// ============================================================
export interface CoinMeta {
  symbol: string; // 如 "BTCUSDT"
  base: string; // "BTC"
  name: string;
  basePrice: number; // 起始价格
  drift: number; // 趋势强度（每日百分比漂移）
  volatility: number; // 波动率
  priority: number; // 首页优先级
}

export const COINS: CoinMeta[] = [
  { symbol: "BTCUSDT", base: "BTC", name: "Bitcoin", basePrice: 104500, drift: 0.9, volatility: 0.02, priority: 1 },
  { symbol: "ETHUSDT", base: "ETH", name: "Ethereum", basePrice: 3380, drift: 0.6, volatility: 0.025, priority: 2 },
  { symbol: "SOLUSDT", base: "SOL", name: "Solana", basePrice: 182, drift: 0.5, volatility: 0.038, priority: 3 },
  { symbol: "BNBUSDT", base: "BNB", name: "BNB", basePrice: 690, drift: 0.15, volatility: 0.022, priority: 4 },
  { symbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin", basePrice: 0.32, drift: -0.4, volatility: 0.045, priority: 5 },
  { symbol: "XRPUSDT", base: "XRP", name: "XRP", basePrice: 2.32, drift: -0.2, volatility: 0.04, priority: 6 },
  { symbol: "SUIUSDT", base: "SUI", name: "Sui", basePrice: 4.1, drift: 0.7, volatility: 0.055, priority: 7 },
  { symbol: "LINKUSDT", base: "LINK", name: "Chainlink", basePrice: 22.4, drift: 0.3, volatility: 0.04, priority: 8 },
  { symbol: "AVAXUSDT", base: "AVAX", name: "Avalanche", basePrice: 41.0, drift: -0.1, volatility: 0.042, priority: 9 },
  { symbol: "AAVEUSDT", base: "AAVE", name: "Aave", basePrice: 305, drift: 0.4, volatility: 0.05, priority: 10 },
];

export const TIMEFRAMES = ["1H", "4H", "1D", "1W"] as const;
export const TIMEFRAME_SECONDS: Record<string, number> = {
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "1W": 604800,
};