import type { Settings } from "@/types";

export const DEFAULT_SETTINGS: Settings = {
  riskPerTrade: 1, // 单笔风险 1%
  maxPortfolioHeat: 6,
  defaultLeverage: 5,
  exchange: "OKX",
  dataProvider: "MOCK",
  preferredTimeframe: "4H",
  signalThreshold: 70,
  watchlist: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "DOGEUSDT", "XRPUSDT", "SUIUSDT", "LINKUSDT", "AVAXUSDT", "AAVEUSDT"],
  strategyParams: {
    maFast: 20,
    maMid: 50,
    maSlow: 80,
  },
  heatSafe: 2,
  heatCaution: 4,
  heatWarning: 6,
  heatDanger: 6,
  liveTradingEnabled: false,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem("pto.settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("pto.settings", JSON.stringify(s));
  } catch {
    /* ignore */
  }
}