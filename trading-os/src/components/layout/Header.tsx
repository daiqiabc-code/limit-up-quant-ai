"use client";

import { useTradingStore } from "@/store/tradingStore";
import { formatPrice, formatPct, tfAgo } from "@/lib/utils";
import { REGIME_LABEL, regimeTone } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";
import { Bell, Wifi, WifiOff, Server, Circle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const lastUpdate = useTradingStore((s) => s.lastUpdate);
  const copilotOpen = useTradingStore((s) => s.copilotOpen);
  const setCopilotOpen = useTradingStore((s) => s.setCopilotOpen);

  const btc = snapshot?.assets["BTCUSDT"];
  const regime = snapshot?.regime;
  const wsOnline = snapshot != null; // mock 引擎在线视为连接

  const ds = snapshot?.dataSource ?? "MOCK";
  const dsBadge: Record<string, { label: string; tone: "bull" | "warn" | "neutral" | "info" }> = {
    MOCK: { label: "模拟数据", tone: "neutral" },
    LIVE_OKX: { label: "OKX 实时", tone: "bull" },
    LIVE_BINANCE: { label: "Binance 实时", tone: "bull" },
    FALLBACK: { label: "降级模拟", tone: "warn" },
  };
  const dsMeta = dsBadge[ds] ?? { label: "模拟数据", tone: "neutral" as const };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-panel px-4">
      <div className="flex items-center gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-text">BTCUSDT</span>
          <span className="num text-sm font-semibold text-text">
            {btc ? formatPrice(btc.price) : "—"}
          </span>
          {btc && (
            <span
              className={cn(
                "num text-xs",
                btc.change24h >= 0 ? "text-bull" : "text-bear",
              )}
            >
              {formatPct(btc.change24h)}
            </span>
          )}
        </div>

        {regime && (
          <div className="hidden items-center gap-2 md:flex">
            <Badge tone={regimeTone(regime.state)} dot>
              Market Regime: {REGIME_LABEL[regime.state]}
            </Badge>
          </div>
        )}

        <div className="hidden items-center gap-1 text-xs text-muted lg:flex">
          <Circle className="h-1.5 w-1.5 fill-bull text-bull" />
          Last Update: {lastUpdate ? tfAgo(lastUpdate) : "—"}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-4 text-[11px] text-muted sm:flex">
          <Badge tone={dsMeta.tone} dot>{dsMeta.label}</Badge>
          {snapshot?.liveTradingEnabled && <Badge tone="bear" dot>真实交易</Badge>}
          <span>Exchange: <span className="text-text">{snapshot?.exchange ?? "OKX"}</span></span>
          <span>Account: <span className="text-bull">Connected</span></span>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-text" aria-label="通知">
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1 rounded-md p-1.5 text-muted" title="WebSocket 状态">
            {wsOnline ? <Wifi className="h-4 w-4 text-bull" /> : <WifiOff className="h-4 w-4 text-bear" />}
          </div>
          <div className="flex items-center gap-1 rounded-md p-1.5 text-muted" title="API 状态">
            <Server className="h-4 w-4 text-bull" />
          </div>
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              copilotOpen ? "bg-info/10 text-info" : "text-muted hover:bg-white/5 hover:text-text",
            )}
            aria-label="Trader Copilot"
          >
            <Bot className="h-4 w-4" />
          </button>
          <div className="ml-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-text">
            T
          </div>
        </div>
      </div>
    </header>
  );
}