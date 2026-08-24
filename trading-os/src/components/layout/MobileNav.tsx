"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Radar, Wallet, ShieldAlert, BookOpen } from "lucide-react";

const NAV = [
  { href: "/", label: "首页", icon: LayoutDashboard },
  { href: "/opportunities", label: "机会", icon: Radar },
  { href: "/positions", label: "持仓", icon: Wallet },
  { href: "/risk", label: "风险", icon: ShieldAlert },
  { href: "/journal", label: "日志", icon: BookOpen },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 border-t border-border bg-panel md:hidden">
      {NAV.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px]",
              active ? "text-bull" : "text-muted",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}