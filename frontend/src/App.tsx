import { useEffect, useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  FileSearch,
  Building2,
  Lightbulb,
  Crosshair,
  Thermometer,
  Settings as SettingsIcon,
  Zap,
  Activity,
  Menu,
  X as CloseIcon,
  Database,
} from 'lucide-react';
import { useStore } from './store';
import Dashboard from './pages/Dashboard';
import LimitUpList from './pages/LimitUpList';
import AiRanking from './pages/AiRanking';
import StockDetail from './pages/StockDetail';
import IndustryAnalysis from './pages/IndustryAnalysis';
import ThemeAnalysis from './pages/ThemeAnalysis';
import PotentialLimitUp from './pages/PotentialLimitUp';
import MarketSentiment from './pages/MarketSentiment';
import LearningSystem from './pages/LearningSystem';
import Settings from './pages/Settings';

type Page =
  | 'dashboard'
  | 'limitup'
  | 'ranking'
  | 'detail'
  | 'industry'
  | 'theme'
  | 'scanner'
  | 'sentiment'
  | 'learning'
  | 'settings';

const menuItems: { id: Page; label: string; icon: ReactNode }[] = [
  { id: 'dashboard', label: '总览看板', icon: <LayoutDashboard size={18} /> },
  { id: 'limitup', label: '昨日涨停', icon: <TrendingUp size={18} /> },
  { id: 'ranking', label: 'AI排行榜', icon: <BarChart3 size={18} /> },
  { id: 'detail', label: '股票详情', icon: <FileSearch size={18} /> },
  { id: 'industry', label: '行业分析', icon: <Building2 size={18} /> },
  { id: 'theme', label: '题材分析', icon: <Lightbulb size={18} /> },
  { id: 'scanner', label: '涨停潜力榜', icon: <Crosshair size={18} /> },
  { id: 'sentiment', label: '市场情绪', icon: <Thermometer size={18} /> },
  { id: 'learning', label: 'AI学习系统', icon: <Zap size={18} /> },
  { id: 'settings', label: '设置', icon: <SettingsIcon size={18} /> },
];

export default function App() {
  const { dashboard, refreshDashboard, meta } = useStore();
  const [page, setPage] = useState<Page>('dashboard');
  const [detailCode, setDetailCode] = useState('');
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    refreshDashboard();
  }, []);

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setDetailCode(e.detail.code);
      setPage('detail');
      setNavOpen(false);
    };
    window.addEventListener('navigate-detail', handler as EventListener);
    return () => window.removeEventListener('navigate-detail', handler as EventListener);
  }, []);

  const go = (p: Page) => {
    setPage(p);
    setNavOpen(false);
  };
  const activeLabel = menuItems.find((m) => m.id === page)?.label ?? '总览看板';
  const collector = dashboard?.collector ?? meta?.collector ?? '—';
  const tradeDate =
    meta?.trade_date ?? dashboard?.snapshot?.trade_date ?? '';
  const environment = meta?.environment ?? '—';

  return (
    <div className="flex h-screen bg-terminal-bg overflow-hidden">
      {/* ---- 移动端遮罩 ---- */}
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* ---- 侧边栏（桌面常驻 / 移动抽屉） ---- */}
      <aside
        className={`bg-terminal-panel border-r border-terminal-border flex flex-col shrink-0
          w-60 lg:w-56 z-50 transition-transform duration-200
          fixed inset-y-0 left-0 lg:static
          ${navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-4 border-b border-terminal-border flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity size={20} className="text-terminal-accent" />
              <span className="font-bold text-sm text-terminal-accent">
                Limit-Up Quant AI
              </span>
            </div>
            <div className="text-xs text-terminal-dim mt-1">{tradeDate || '—'}</div>
          </div>
          <button
            className="lg:hidden text-terminal-dim p-1"
            onClick={() => setNavOpen(false)}
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map((m) => (
            <button
              key={m.id}
              onClick={() => go(m.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 lg:py-2.5 text-sm transition-colors ${
                page === m.id
                  ? 'bg-terminal-accent/10 text-terminal-accent border-r-2 border-terminal-accent'
                  : 'text-terminal-dim hover:text-terminal-text hover:bg-terminal-card/50'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
              {m.id === 'ranking' && (
                <span className="ml-auto text-[10px] bg-terminal-accent/20 text-terminal-accent px-1.5 rounded">
                  AI
                </span>
              )}
              {m.id === 'scanner' && (
                <span className="ml-auto text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 rounded">
                  🔥新
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* ---- 数据源状态 ---- */}
        <div className="p-3 border-t border-terminal-border text-[11px] leading-relaxed">
          <div className="flex items-center gap-1.5">
            <Database size={12} className="text-amber-400" />
            <span className="text-amber-400">静态快照模式</span>
          </div>
          <div className="text-terminal-dim mt-0.5">数据源：{collector}</div>
          <div className="text-terminal-dim">环境：{environment}</div>
          {meta?.generated_at && (
            <div className="text-terminal-dim">快照于 {meta.generated_at}</div>
          )}
          <div className="text-terminal-dim/70 mt-0.5">v1.0 · 静态部署</div>
        </div>
      </aside>

      {/* ---- 主内容 ---- */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶栏 */}
        <header className="lg:hidden flex items-center gap-3 px-3 h-12 bg-terminal-panel border-b border-terminal-border shrink-0">
          <button onClick={() => setNavOpen(true)} className="text-terminal-text p-1">
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-terminal-text">{activeLabel}</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-terminal-dim">
            <Database size={11} className="text-amber-400" />
            {tradeDate || '—'}
          </span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-auto">
          {page === 'dashboard' && <Dashboard />}
          {page === 'limitup' && <LimitUpList />}
          {page === 'ranking' && <AiRanking />}
          {page === 'detail' && <StockDetail code={detailCode} />}
          {page === 'industry' && <IndustryAnalysis />}
          {page === 'theme' && <ThemeAnalysis />}
          {page === 'scanner' && <PotentialLimitUp />}
          {page === 'sentiment' && <MarketSentiment />}
          {page === 'learning' && <LearningSystem />}
          {page === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
