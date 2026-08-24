"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatValue } from "@/components/ui/State";
import { formatPrice, formatPct, cn } from "@/lib/utils";

export function ExecutionPanel() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;
  const orders = snapshot.orders;
  const stats = snapshot.executionStats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="p-3"><StatValue label="Avg Slippage" value={`${stats.avgSlippage}%`} /></Card>
        <Card className="p-3"><StatValue label="Avg Fee" value={`${stats.avgFee}%`} /></Card>
        <Card className="p-3"><StatValue label="Avg Exec Time" value={`${stats.avgLatencyMs}ms`} /></Card>
        <Card className="p-3"><StatValue label="Funding Cost" value={`$${stats.fundingCost}`} /></Card>
        <Card className="p-3">
          <StatValue label="Execution Deviation" value={`+${stats.deviation}%`} tone="warn" />
        </Card>
      </div>

      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">Execution Log</h3>
          <p className="text-xs text-muted">Expected vs Actual Entry · 自动计算执行偏差</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Expected</th>
                <th className="px-3 py-2 font-medium">Actual</th>
                <th className="px-3 py-2 font-medium">Slippage</th>
                <th className="px-3 py-2 font-medium">Fee</th>
                <th className="px-3 py-2 font-medium">Latency</th>
                <th className="px-3 py-2 font-medium">Deviation</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const dev = ((o.actualPrice - o.expectedPrice) / o.expectedPrice) * 100;
                return (
                  <tr key={o.id} className="border-b border-border/60">
                    <td className="px-3 py-2.5 font-medium text-text">{o.symbol.replace("USDT", "")}</td>
                    <td className="px-3 py-2.5"><Badge tone={o.side === "LONG" ? "bull" : "bear"}>{o.side}</Badge></td>
                    <td className="num px-3 py-2.5 text-muted">{formatPrice(o.expectedPrice)}</td>
                    <td className="num px-3 py-2.5 text-text">{formatPrice(o.actualPrice)}</td>
                    <td className={cn("num px-3 py-2.5", o.slippage >= 0 ? "text-text" : "text-bull")}>{formatPct(o.slippage, 3)}</td>
                    <td className="num px-3 py-2.5 text-muted">{formatPrice(o.fee, 2)}</td>
                    <td className="num px-3 py-2.5 text-muted">{o.latencyMs}ms</td>
                    <td className={cn("num px-3 py-2.5", Math.abs(dev) > 0.1 ? "text-warn" : "text-bull")}>{formatPct(dev, 3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}