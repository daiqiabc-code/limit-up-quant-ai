"use client";

import { ticker } from "@/lib/data";
import { cn } from "@/lib/utils";

function TickerRow() {
  return (
    <>
      {ticker.map((t) => {
        const up = t.change >= 0;
        return (
          <span key={t.symbol} className="mx-1 inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="font-mono text-2xs font-semibold text-ink-high">{t.symbol}</span>
            <span className="font-mono text-2xs text-ink-mid tnum">
              {t.price >= 1
                ? t.price.toLocaleString("en-US", { maximumFractionDigits: t.price >= 1000 ? 0 : 2 })
                : t.price.toPrecision(3)}
            </span>
            <span className={cn("font-mono text-2xs tnum", up ? "text-bull" : "text-bear")}>
              {up ? "▲" : "▼"}
              {Math.abs(t.change).toFixed(2)}%
            </span>
            <span className="mx-2 text-ink-faint">·</span>
          </span>
        );
      })}
    </>
  );
}

export function TickerTape() {
  return (
    <div className="relative overflow-hidden border-y border-line bg-bg-canvas/60">
      <div className="mask-fade-x flex">
        <div className="flex shrink-0 animate-ticker-scroll items-center py-1.5">
          <TickerRow />
          <TickerRow />
        </div>
      </div>
    </div>
  );
}
