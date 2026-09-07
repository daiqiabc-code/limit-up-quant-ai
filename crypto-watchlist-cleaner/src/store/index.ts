// =============================================================
// 全局状态（zustand）
// 市场数据 + 用户自选 / 收藏 / 删除覆盖
// =============================================================
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ScoredCoin, MarketSnapshot, Alert } from "../lib/types";
import { loadMarketData } from "../lib/data/market";

export type WatchCategory =
  | "Core"
  | "Swing"
  | "Meme"
  | "NewNarrative"
  | "Robinhood";

export const WATCH_CATEGORIES: { value: WatchCategory; label: string }[] = [
  { value: "Core", label: "核心资产" },
  { value: "Swing", label: "波段机会" },
  { value: "Meme", label: "Meme" },
  { value: "NewNarrative", label: "新叙事" },
  { value: "Robinhood", label: "Robinhood Chain" },
];

interface CryptoStore {
  // 市场数据
  coins: ScoredCoin[];
  snapshot: MarketSnapshot | null;
  alerts: Alert[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;

  // 用户数据（持久化）
  favorites: string[];
  watchlist: Record<string, WatchCategory>;
  removed: Record<string, true>;

  toggleFavorite: (id: string) => void;
  setWatchCategory: (id: string, cat: WatchCategory | null) => void;
  removeCoin: (id: string) => void;
  restoreCoin: (id: string) => void;
}

export const useCryptoStore = create<CryptoStore>()(
  persist(
    (set, get) => ({
      coins: [],
      snapshot: null,
      alerts: [],
      loading: false,
      error: null,

      load: async () => {
        // 避免重复并发加载
        if (get().loading) return;
        set({ loading: true, error: null });
        try {
          const { coins, snapshot, alerts } = await loadMarketData();
          set({ coins, snapshot, alerts, loading: false });
        } catch (e) {
          set({
            loading: false,
            error: e instanceof Error ? e.message : "数据加载失败",
          });
        }
      },

      favorites: [],
      watchlist: {},
      removed: {},

      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((x) => x !== id)
            : [...s.favorites, id],
        })),

      setWatchCategory: (id, cat) =>
        set((s) => {
          const next = { ...s.watchlist };
          if (cat === null) delete next[id];
          else next[id] = cat;
          return { watchlist: next };
        }),

      // 手动删除（软删除，可 Undo）
      removeCoin: (id) => set((s) => ({ removed: { ...s.removed, [id]: true } })),
      restoreCoin: (id) =>
        set((s) => {
          const next = { ...s.removed };
          delete next[id];
          return { removed: next };
        }),
    }),
    {
      name: "cwc-store",
      storage: createJSONStorage(() => localStorage),
      // 仅持久化用户态，市场数据每次重新计算
      partialize: (s) => ({
        favorites: s.favorites,
        watchlist: s.watchlist,
        removed: s.removed,
      }),
    },
  ),
);