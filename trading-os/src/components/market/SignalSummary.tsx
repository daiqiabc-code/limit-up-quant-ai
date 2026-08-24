"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { TREND_LABEL } from "@/lib/labels";

export function SignalSummary() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const symbol = useTradingStore((s) => s.selectedSymbol);
  const openSignalDetail = useTradingStore((s) => s.openSignalDetail);
  if (!snapshot) return null;
  const signal = snapshot.signals[symbol];
  if (!signal) return null;

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Signal</h3>
        <button onClick={() => openSignalDetail(symbol)} className="text-[11px] font-medium text-info hover:underline">
          详情 →
        </button>
      </div>

      <div className="space-y-3">
        <Row label="Trend" value={TREND_LABEL[signal.trend]} tone={signal.trend === "BULL" ? "text-bull" : signal.trend === "BEAR" ? "text-bear" : "text-warn"} />
        <Row label="Structure" value={signal.trend === "BULL" ? "HH → HL → HH" : signal.trend === "BEAR" ? "LH → LL" : "Range"} />
        <Row label="Setup" value={`${signal.setup} → ${signal.setupStage}`} />
        <div className="border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Signal Score</span>
            <span className="num text-2xl font-bold text-text">{signal.score}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className={cn("h-full rounded-full", signal.score >= 80 ? "bg-bull" : signal.score >= 60 ? "bg-warn" : "bg-bear")}
              style={{ width: `${signal.score}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("text-right text-xs font-medium text-text", tone)}>{value}</span>
    </div>
  );
}