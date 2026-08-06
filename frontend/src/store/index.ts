import { create } from 'zustand';
import { api, type DashboardSnapshot, type SnapshotMeta } from '../lib/api';

interface AppState {
  date: string;
  setDate: (d: string) => void;
  dashboard: DashboardSnapshot | null;
  meta: SnapshotMeta | null;
  refreshDashboard: () => Promise<void>;
  loading: boolean;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  date: '',
  setDate: (d) => set({ date: d }),
  dashboard: null,
  meta: null,
  refreshDashboard: async () => {
    set({ loading: true });
    try {
      const [data, meta] = await Promise.all([api.dashboard(), api.meta().catch(() => null)]);
      set({
        dashboard: data,
        meta,
        date: data.snapshot.trade_date,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
  loading: false,
  showChat: false,
  setShowChat: (v) => set({ showChat: v }),
}));
