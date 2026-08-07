"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, Search, Command, Bell, Settings, Radio } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "情报终端" },
  { href: "/events", label: "事件" },
  { href: "/kols", label: "KOL" },
  { href: "/projects", label: "项目" },
  { href: "/sentiment", label: "情绪" },
  { href: "/daily", label: "AI日报" },
  { href: "/admin", label: "后台" },
];

function Clock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const tick = () =>
      setT(
        new Date().toLocaleTimeString("zh-CN", {
          hour12: false,
          timeZone: "Asia/Shanghai",
        }) + " CST"
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-2xs text-ink-low tnum">{t}</span>;
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-bg-base/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-4 px-4 lg:px-6">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-signal/30 bg-signal/10">
              <Activity className="h-4 w-4 text-signal" />
              <span className="absolute inset-0 rounded-lg bg-signal/20 opacity-0 blur transition-opacity group-hover:opacity-100" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-sm font-bold tracking-tight text-ink-high">
                CryptoPulse
              </span>
              <span className="text-[9px] font-medium uppercase tracking-[0.2em] text-signal/80">
                AI · Intelligence
              </span>
            </div>
          </Link>

          {/* Nav */}
          <nav className="ml-4 hidden items-center gap-0.5 lg:flex">
            {NAV.map((n) => {
              const isActive =
                n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn("nav-link", isActive && "nav-link-active bg-bg-elevated")}
                >
                  {n.label}
                  {isActive && (
                    <span className="absolute -bottom-[14px] left-3 right-3 h-px bg-signal" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          {/* Live status */}
          <div className="hidden items-center gap-2 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 md:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bull/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-bull" />
            </span>
            <span className="text-2xs font-medium text-ink-mid">实时采集中</span>
            <Clock />
          </div>

          {/* Search */}
          <button
            onClick={() => setOpen(true)}
            className="group flex items-center gap-2 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-ink-low transition-colors hover:border-line-strong hover:text-ink-mid"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden text-xs sm:inline">搜索 / 问 AI</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-line bg-bg-base px-1 py-0.5 font-mono text-[10px] sm:flex">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <div className="flex items-center gap-1">
            <button className="btn-ghost h-8 w-8 !p-0" aria-label="实时信号">
              <Radio className="h-4 w-4" />
            </button>
            <button className="btn-ghost relative h-8 w-8 !p-0" aria-label="通知">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-bear" />
            </button>
            <Link href="/admin" className="btn-ghost h-8 w-8 !p-0" aria-label="设置">
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
