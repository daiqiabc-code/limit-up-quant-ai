"use client";

import { useLivePrices } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "HYPE", "DOGE", "ONDO", "LINK", "AAVE", "AVAX", "SUI", "TIA", "ENA", "PEPE", "WIF"];

function fmtPrice(p: number) {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 0.01) return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return p.toPrecision(p >= 0.0001 ? 3 : 2);
}

function TickerRow({ items }: { items: ReturnType<typeof useLivePrices>["prices"] }) {
  return (
    <>
      {items.map((t) => {
        const up = t.change >= 0;
        return (
          <span key={t.symbol} className="mx-1 inline-flex items-center gap-1.5 whitespace-nowrap align-middle">
            <span className="font-mono text-2xs font-semibold text-ink-high">{t.symbol}</span>
            <span
              className={cn(
                "font-mono text-2xs tnum transition-colors",
                t.live ? "text-ink-high" : "text-ink-faint/70"
              )}
              title={t.live ? `实时价 · ${t.source || "-"}` : "本地基准价"}
            >
              {fmtPrice(t.price)}
            </span>
            <span className={cn("font-mono text-2xs tnum", up ? "text-bull" : "text-bear")}>
              {up ? "▲" : "▼"}
              {Math.abs(t.change).toFixed(2)}%
            </span>
            {t.live ? (
              <span
                className="mx-0.5 inline-flex items-center rounded-sm bg-emerald-500/15 px-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 ring-1 ring-emerald-500/30"
                title={`实时数据源：${t.source || "-"}`}
              >
                LIVE
              </span>
            ) : (
              <span className="mx-0.5 inline-flex items-center rounded-sm bg-zinc-500/10 px-1 text-[9px] font-semibold uppercase tracking-wider text-zinc-500 ring-1 ring-zinc-500/20">
                离线
              </span>
            )}
            <span className="mx-2 text-ink-faint">·</span>
          </span>
        );
      })}
    </>
  );
}

export function TickerTape() {
  const { prices } = useLivePrices();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const display = useMemo(
    () =>
      ready && prices.length
        ? prices
        : SYMBOLS.map((s) => ({ symbol: s, price: 0, change: 0, live: false as const, source: "本地基准" })),
    [ready, prices]
  );

  return (
    <div className="relative overflow-hidden border-y border-line bg-bg-canvas/60">
      <div className="mask-fade-x flex">
        <div className="flex shrink-0 animate-ticker-scroll items-center py-1.5">
          <TickerRow items={display} />
          <TickerRow items={display} />
        </div>
      </div>
    </div>
  );
}