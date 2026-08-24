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
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/market", label: "Market", icon: CandlestickChart },
  { href: "/opportunities", label: "Opportunities", icon: Radar },
  { href: "/positions", label: "Positions", icon: Wallet },
  { href: "/risk", label: "Risk", icon: ShieldAlert },
  { href: "/execution", label: "Execution", icon: Zap },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/strategies", label: "Strategies", icon: Target },
  { href: "/intelligence", label: "Intelligence", icon: BrainCircuit },
  { href: "/settings", label: "Settings", icon: Settings },
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
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted">Personal</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 px-2 text-[10px] uppercase tracking-[0.15em] text-muted/60">
          Terminal
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
        <span className="text-warn">SIMULATION MODE</span>
        <br />
        Paper Trading · No real orders
      </div>
    </aside>
  );
}