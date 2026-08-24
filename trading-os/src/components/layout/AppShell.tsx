"use client";

import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TraderCopilot } from "@/components/copilot/TraderCopilot";
import { MobileNav } from "./MobileNav";
import { useTradingStore } from "@/store/tradingStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const init = useTradingStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <div className="hidden md:flex">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <TraderCopilot />
      <MobileNav />
    </div>
  );
}