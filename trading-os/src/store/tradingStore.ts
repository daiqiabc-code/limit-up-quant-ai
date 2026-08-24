"use client";

import { create } from "zustand";
import type { TradingSnapshot, Signal, Opportunity, Settings, Trade, JournalEntry } from "@/types";
import type { ExchangeProvider } from "@/services/provider";
import { createProvider, type DataProviderId } from "@/services/exchanges";
import { COINS } from "@/services/mock/universe";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/settings";

const SYMBOLS = COINS.map((c) => c.symbol);
const REFRESH_MS = 4000;

function buildProvider(s: Settings): ExchangeProvider {
  return createProvider(s.dataProvider as DataProviderId, {
    symbols: SYMBOLS,
    seed: 20260824,
    credentials: {
      apiKey: s.apiKey,
      apiSecret: s.apiSecret,
      apiPassphrase: s.apiPassphrase,
    },
    liveTrading: s.liveTradingEnabled ?? false,
  });
}

interface TradingState {
  // 数据
  snapshot: TradingSnapshot | null;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  // 图表 & UI
  selectedSymbol: string;
  timeframe: string;
  settings: Settings;
  // drawer / modal
  activeOpportunity: Opportunity | null;
  signalDetailSymbol: string | null;
  // copilot
  copilotOpen: boolean;
  // journal (本地)
  trades: Trade[];
  journalEntries: JournalEntry[];

  // actions
  init: () => void;
  refresh: () => Promise<void>;
  setSelectedSymbol: (s: string) => void;
  setTimeframe: (t: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  openOpportunity: (o: Opportunity | null) => void;
  openSignalDetail: (symbol: string | null) => void;
  setCopilotOpen: (open: boolean) => void;
  addTrade: (t: Trade) => void;
  updateTrade: (t: Trade) => void;
  addJournalEntry: (j: JournalEntry) => void;
}

let activeProvider: ExchangeProvider = buildProvider(DEFAULT_SETTINGS);
export function getMarketClient(): ExchangeProvider {
  return activeProvider;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  snapshot: null,
  loading: true,
  error: null,
  lastUpdate: 0,
  selectedSymbol: "BTCUSDT",
  timeframe: "4H",
  settings: DEFAULT_SETTINGS,
  activeOpportunity: null,
  signalDetailSymbol: null,
  copilotOpen: true,
  trades: [],
  journalEntries: [],

  init: () => {
    if (typeof window === "undefined") return;
    const settings = loadSettings();
    activeProvider = buildProvider(settings);
    set({ settings });
    try {
      const trades = JSON.parse(window.localStorage.getItem("pto.trades") ?? "[]") as Trade[];
      const journal = JSON.parse(window.localStorage.getItem("pto.journal") ?? "[]") as JournalEntry[];
      set({ trades, journalEntries: journal });
    } catch {
      /* ignore */
    }
    void get().refresh();
    // 轮询引擎
    setInterval(() => {
      void get().refresh();
    }, REFRESH_MS);
  },

  refresh: async () => {
    try {
      const snapshot = await activeProvider.getSnapshot(SYMBOLS);
      set({ snapshot, loading: false, error: null, lastUpdate: Date.now() });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "数据加载失败", loading: false });
    }
  },

  setSelectedSymbol: (s) => set({ selectedSymbol: s }),
  setTimeframe: (t) => set({ timeframe: t }),
  updateSettings: (patch) => {
    const prev = get().settings;
    const next = { ...prev, ...patch };
    set({ settings: next });
    saveSettings(next);
    // 数据源 / 凭证 / 实盘开关变化时重建 Provider 并立即刷新
    const keys: (keyof Settings)[] = ["dataProvider", "apiKey", "apiSecret", "apiPassphrase", "liveTradingEnabled"];
    if (keys.some((k) => next[k] !== prev[k])) {
      activeProvider = buildProvider(next);
      void get().refresh();
    }
  },
  openOpportunity: (o) => set({ activeOpportunity: o }),
  openSignalDetail: (symbol) => set({ signalDetailSymbol: symbol }),
  setCopilotOpen: (open) => set({ copilotOpen: open }),

  addTrade: (t) => {
    const trades = [t, ...get().trades];
    set({ trades });
    if (typeof window !== "undefined") window.localStorage.setItem("pto.trades", JSON.stringify(trades));
  },
  updateTrade: (t) => {
    const trades = get().trades.map((x) => (x.id === t.id ? t : x));
    set({ trades });
    if (typeof window !== "undefined") window.localStorage.setItem("pto.trades", JSON.stringify(trades));
  },
  addJournalEntry: (j) => {
    const journal = [j, ...get().journalEntries.filter((x) => x.date !== j.date)];
    set({ journalEntries: journal });
    if (typeof window !== "undefined") window.localStorage.setItem("pto.journal", JSON.stringify(journal));
  },
}));

// 派生：由 Signal + Asset + Regime 组成 Opportunity
export function buildOpportunities(snapshot: TradingSnapshot): Opportunity[] {
  return COINS.map((coin) => {
    const signal = snapshot.signals[coin.symbol];
    const asset = snapshot.assets[coin.symbol];
    const regime = coin.symbol === snapshot.regime.symbol ? snapshot.regime : snapshot.regime;
    return {
      ...signal,
      name: coin.name,
      price: asset?.price ?? 0,
      change24h: asset?.change24h ?? 0,
      volume24h: asset?.volume24h ?? 0,
      regime: regime,
      priority: coin.priority,
    } as Opportunity;
  }).sort((a, b) => b.score - a.score);
}

export function getTodayAction(snapshot: TradingSnapshot): "TRADE" | "WAIT" | "NO_TRADE" {
  const valid = snapshot.signals;
  const longable = Object.values(valid).filter((s) => s.action === "LONG").length;
  const watchable = Object.values(valid).filter((s) => s.action === "WATCH").length;
  if (snapshot.risk.status === "DANGER" || snapshot.risk.status === "WARNING") return "NO_TRADE";
  if (longable >= 1) return "TRADE";
  if (watchable >= 2) return "WAIT";
  return "WAIT";
}