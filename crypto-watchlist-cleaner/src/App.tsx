// =============================================================
// 应用入口（路由）
// =============================================================
import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useCryptoStore } from "./store";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Top20 from "./pages/Top20";
import Market from "./pages/Market";
import Grades from "./pages/Grades";
import Remove from "./pages/Remove";
import Watchlist from "./pages/Watchlist";
import Alerts from "./pages/Alerts";
import CoinDetail from "./pages/CoinDetail";

export default function App() {
  const load = useCryptoStore((s) => s.load);
  const loading = useCryptoStore((s) => s.loading);
  const error = useCryptoStore((s) => s.error);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-terminal-bg text-terminal-muted">
        <div className="text-center">
          <div className="mb-3 text-2xl text-emerald-400">◉</div>
          <div className="text-sm">正在扫描全市场并计算评分…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-terminal-bg p-6">
        <div className="max-w-md rounded-lg border border-rose-500/30 bg-rose-500/10 p-6 text-rose-400">
          <div className="mb-2 font-semibold">数据加载失败</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="top20" element={<Top20 />} />
        <Route path="market" element={<Market />} />
        <Route path="grades" element={<Grades />} />
        <Route path="remove" element={<Remove />} />
        <Route path="watchlist" element={<Watchlist />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="coin/:symbol" element={<CoinDetail />} />
      </Route>
    </Routes>
  );
}