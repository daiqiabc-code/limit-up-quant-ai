"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CandlestickChart,
  Radar,
  Wallet,
  ShieldAlert,
  Zap,
  BookOpen,
  BarChart3,
  Target,
  BrainCircuit,
  Settings,
} from "lucide-react";

const NAV = [
  { href: "/", label: "总览", icon: LayoutDashboard },
  { href: "/market", label: "行情", icon: CandlestickChart },
  { href: "/opportunities", label: "机会", icon: Radar },
  { href: "/positions", label: "持仓", icon: Wallet },
  { href: "/risk", label: "风控", icon: ShieldAlert },
  { href: "/execution", label: "执行", icon: Zap },
  { href: "/journal", label: "日志", icon: BookOpen },
  { href: "/analytics", label: "复盘", icon: BarChart3 },
  { href: "/strategies", label: "策略", icon: Target },
  { href: "/intelligence", label: "情报", icon: BrainCircuit },
  { href: "/settings", label: "设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-panel">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-bull/15 text-bull">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold tracking-wide text-text">TRADING OS</div>
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted">个人交易操作系统</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 px-2 text-[10px] uppercase tracking-[0.15em] text-muted/60">
          终端
        </div>
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-white/5 text-text"
                  : "text-muted hover:bg-white/5 hover:text-text",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-bull" : "text-muted group-hover:text-text")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-3 text-[10px] leading-relaxed text-muted/60">
        <span className="text-warn">模拟模式</span>
        <br />
        纸上交易 · 无真实订单
      </div>
    </aside>
  );
}