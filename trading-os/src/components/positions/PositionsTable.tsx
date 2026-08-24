"use client";

import { useState } from "react";
import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatPrice, formatUsd, formatPct, cn } from "@/lib/utils";
import type { Position } from "@/types";

export function PositionsTable({ compact = false }: { compact?: boolean }) {
  const snapshot = useTradingStore((s) => s.snapshot);
  const positions = snapshot?.positions ?? [];

  if (positions.length === 0) {
    return (
      <Card>
        <div className="py-8 text-center text-sm text-muted">暂无持仓</div>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="px-3 py-2 font-medium">Symbol</th>
            <th className="px-3 py-2 font-medium">Side</th>
            <th className="px-3 py-2 font-medium">Entry</th>
            <th className="px-3 py-2 font-medium">Mark</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Lev</th>
            <th className="px-3 py-2 font-medium">uPnL</th>
            <th className="px-3 py-2 font-medium">Stop</th>
            <th className="px-3 py-2 font-medium">TP</th>
            <th className="px-3 py-2 font-medium">Liq</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <PositionRow key={p.id} p={p} compact={compact} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PositionRow({ p, compact }: { p: Position; compact: boolean }) {
  const pnlPos = p.unrealizedPnl >= 0;
  return (
    <tr className="border-b border-border/60 transition-colors hover:bg-white/5">
      <td className="px-3 py-2.5">
        <span className="font-medium text-text">{p.symbol.replace("USDT", "")}</span>
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={p.side === "LONG" ? "bull" : "bear"}>{p.side}</Badge>
      </td>
      <td className="num px-3 py-2.5 text-text">{formatPrice(p.entry)}</td>
      <td className="num px-3 py-2.5 text-text">{formatPrice(p.markPrice)}</td>
      <td className="num px-3 py-2.5 text-text">{formatUsd(p.sizeUsd)}</td>
      <td className="num px-3 py-2.5 text-muted">{p.leverage}X</td>
      <td className={cn("num px-3 py-2.5", pnlPos ? "text-bull" : "text-bear")}>
        {formatUsd(p.unrealizedPnl)}
        <span className="ml-1 text-[11px]">({formatPct(p.unrealizedPnlPct)})</span>
      </td>
      <td className="num px-3 py-2.5 text-bear">{formatPrice(p.stopLoss)}</td>
      <td className="num px-3 py-2.5 text-bull">{formatPrice(p.takeProfit)}</td>
      <td className="num px-3 py-2.5 text-muted">{formatPrice(p.liquidation)}</td>
      <td className="px-3 py-2.5">
        <div className="flex gap-1">
          <ActionBtn label="Reduce" />
          <ActionBtn label="Close" />
          <ActionBtn label="Stop" />
        </div>
      </td>
    </tr>
  );
}

function ActionBtn({ label }: { label: string }) {
  const [clicked, setClicked] = useState(false);
  return (
    <button
      onClick={() => {
        setClicked(true);
        setTimeout(() => setClicked(false), 1200);
      }}
      className={cn(
        "rounded-md border px-2 py-1 text-[10px] font-medium transition-colors",
        clicked ? "border-bull/50 bg-bull/10 text-bull" : "border-border text-muted hover:border-muted hover:text-text",
      )}
    >
      {clicked ? "Paper" : label}
    </button>
  );
}