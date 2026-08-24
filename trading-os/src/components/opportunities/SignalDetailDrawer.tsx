"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Drawer } from "@/components/ui/Drawer";
import { cn, formatPrice } from "@/lib/utils";

const BREAKDOWN = [
  { key: "trend", label: "Trend", max: 20 },
  { key: "structure", label: "Structure", max: 20 },
  { key: "momentum", label: "Momentum", max: 20 },
  { key: "volume", label: "Volume", max: 15 },
  { key: "htfAlignment", label: "HTF Alignment", max: 10 },
  { key: "setup", label: "Setup", max: 10 },
  { key: "riskReward", label: "Risk/Reward", max: 5 },
] as const;

export function SignalDetailDrawer() {
  const symbol = useTradingStore((s) => s.signalDetailSymbol);
  const snapshot = useTradingStore((s) => s.snapshot);
  const openSignalDetail = useTradingStore((s) => s.openSignalDetail);

  const signal = snapshot && symbol ? snapshot.signals[symbol] : undefined;

  return (
    <Drawer
      open={!!symbol && !!signal}
      onClose={() => openSignalDetail(null)}
      title={symbol ? `${symbol.replace("USDT", "")} — Signal 评分` : ""}
      subtitle="完整评分逻辑，0～100 分"
    >
      {signal && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted">Total Score</div>
              <div className="mt-1 text-3xl font-bold text-text">{signal.score}<span className="text-base text-muted">/100</span></div>
            </div>
            <div className="text-right text-xs leading-relaxed text-muted">
              入场 {formatPrice(signal.entry)}
              <br />
              止损 {formatPrice(signal.stop)}
            </div>
          </div>

          <div className="space-y-2.5">
            {BREAKDOWN.map((b) => {
              const v = signal.breakdown[b.key];
              const pct = (v / b.max) * 100;
              const color = pct >= 85 ? "bg-bull" : pct >= 60 ? "bg-warn" : "bg-bear";
              return (
                <div key={b.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted">{b.label}</span>
                    <span className="num text-text">{v}<span className="text-muted">/{b.max}</span></span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div>
            <div className="mb-1 text-[11px] uppercase tracking-wide text-muted">结论理由</div>
            <p className="text-sm leading-relaxed text-text">{signal.reason}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}