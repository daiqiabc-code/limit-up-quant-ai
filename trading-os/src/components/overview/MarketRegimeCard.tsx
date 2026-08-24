"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { regimeColor, REGIME_LABEL, REGIME_LABEL_ZH } from "@/lib/labels";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketRegime as MR } from "@/types";

function Dir({ d }: { d: "UP" | "DOWN" | "FLAT" }) {
  if (d === "UP") return <ArrowUp className="h-3.5 w-3.5 text-bull" />;
  if (d === "DOWN") return <ArrowDown className="h-3.5 w-3.5 text-bear" />;
  return <Minus className="h-3.5 w-3.5 text-warn" />;
}

export function MarketRegimeCard({ regime }: { regime: MR }) {
  const color = regimeColor(regime.state);
  return (
    <Card className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Market Regime</div>
          <div className="mt-1 text-2xl font-bold" style={{ color }}>
            {REGIME_LABEL[regime.state]}
          </div>
          <div className="mt-0.5 text-xs text-muted">{REGIME_LABEL_ZH[regime.state]}</div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <DirCell label="Daily" d={regime.daily} />
          <DirCell label="4H" d={regime.h4} />
          <DirCell label="1H" d={regime.h1} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info label="MA80" value={regime.ma80} />
        <Info label="ADX" value={String(regime.adx)} />
        <Info label="Volume" value={regime.volume} />
        <Info label="Volatility" value={regime.volatility} />
      </div>
      <div className="mt-3 border-t border-border pt-2 text-xs text-muted">
        Structure <span className="font-mono text-text">{regime.structure}</span>
      </div>
    </Card>
  );
}

function DirCell({ label, d }: { label: string; d: "UP" | "DOWN" | "FLAT" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 flex justify-center">
        <Dir d={d} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm font-semibold tabular text-text")}>{value}</div>
    </div>
  );
}