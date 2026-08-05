import { create } from 'zustand';
import { api, DashboardData } from '../lib/api';

interface AppState {
  date: string;
  setDate: (d: string) => void;
  dashboard: DashboardData | null;
  refreshDashboard: () => Promise<void>;
  loading: boolean;
  showChat: boolean;
  setShowChat: (v: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  date: '',
  setDate: (d) => set({ date: d }),
  dashboard: null,
  refreshDashboard: async () => {
    set({ loading: true });
    try {
      const data = await api.dashboard();
      set({ dashboard: data, date: data.snapshot.trade_date, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  loading: false,
  showChat: false,
  setShowChat: (v) => set({ showChat: v }),
}));
