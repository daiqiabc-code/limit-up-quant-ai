// =============================================================
// 应用布局：侧边导航 + 顶栏 + 内容区
// =============================================================
import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Trophy,
  Table2,
  Layers,
  Trash2,
  Star,
  Bell,
  RefreshCw,
  Menu,
  X,
  TrendingUp,
} from "lucide-react";
import { useCryptoStore } from "../store";
import { fmtTime } from "../lib/utils/format";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/top20", label: "Top 20", icon: Trophy },
  { to: "/market", label: "全市场", icon: Table2 },
  { to: "/grades", label: "S / A / B / C", icon: Layers },
  { to: "/remove", label: "删除池", icon: Trash2 },
  { to: "/watchlist", label: "自选", icon: Star },
  { to: "/alerts", label: "预警", icon: Bell },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const snapshot = useCryptoStore((s) => s.snapshot);
  const watchCount = useCryptoStore((s) => Object.keys(s.watchlist).length);
  const load = useCryptoStore((s) => s.load);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors ${
              isActive
                ? "bg-terminal-panel2 text-terminal-bright"
                : "text-terminal-muted hover:bg-terminal-panel hover:text-terminal-fg"
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-terminal-bg text-terminal-fg">
      {/* 桌面侧边栏 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-terminal-border bg-terminal-panel md:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <SidebarFooter watchCount={watchCount} />
      </aside>

      {/* 移动侧边栏 */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-terminal-border bg-terminal-panel">
            <div className="flex items-center justify-between px-4 py-3">
              <Brand />
              <button onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            <SidebarFooter watchCount={watchCount} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶栏 */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-terminal-border bg-terminal-panel px-4">
          <button className="md:hidden" onClick={() => setOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold text-terminal-bright">
              Crypto Watchlist Cleaner
              <span className="ml-2 hidden text-terminal-muted sm:inline">
                加密货币自选清洗器
              </span>
            </h1>
            <p className="hidden truncate text-[11px] text-terminal-muted lg:block">
              1000 Coins → 自动清洗 → Top 100 → Top 20 → Top 10 → 注意力过滤器
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {snapshot && (
              <>
                <span
                  className={`hidden items-center gap-1.5 rounded border px-2 py-1 text-[11px] sm:inline-flex ${
                    snapshot.isDemo
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  }`}
                >
                  <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {snapshot.isDemo ? "Demo 数据 / 模拟" : `实时 · ${snapshot.dataSource}`}
                </span>
                <span className="hidden text-[11px] tabular-nums text-terminal-muted md:inline">
                  更新 {fmtTime(snapshot.dataUpdatedAt)}
                </span>
              </>
            )}
            <button
              onClick={() => load()}
              className="rounded-md border border-terminal-border p-1.5 text-terminal-muted transition-colors hover:text-terminal-bright"
              title="刷新数据"
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </header>

        {/* 内容 */}
        <main className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-4 py-4">
      <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/15 text-emerald-400">
        <TrendingUp size={16} />
      </span>
      <span className="text-[15px] font-bold tracking-tight text-terminal-bright">
        CWC<span className="text-terminal-muted">.</span>
      </span>
    </Link>
  );
}

function SidebarFooter({ watchCount }: { watchCount: number }) {
  const snapshot = useCryptoStore((s) => s.snapshot);
  return (
    <div className="border-t border-terminal-border px-4 py-3 text-[11px] text-terminal-muted">
      <div className="mb-1 flex items-center gap-2">
        <Star size={12} className="text-amber-400" />
        自选 {watchCount} 个
      </div>
      {snapshot && (
        <div className="flex gap-2 tabular-nums">
          <span className="text-violet-400">S {snapshot.gradeCounts.S}</span>
          <span className="text-blue-400">A {snapshot.gradeCounts.A}</span>
          <span className="text-cyan-400">B {snapshot.gradeCounts.B}</span>
          <span className="text-slate-400">C {snapshot.gradeCounts.C}</span>
        </div>
      )}
    </div>
  );
}