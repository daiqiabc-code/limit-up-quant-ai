"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatValue } from "@/components/ui/State";
import { SIDE_LABEL } from "@/lib/labels";
import { formatPrice, formatPct, cn } from "@/lib/utils";

export function ExecutionPanel() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;
  const orders = snapshot.orders;
  const stats = snapshot.executionStats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="p-3"><StatValue label="平均滑点" value={`${stats.avgSlippage}%`} /></Card>
        <Card className="p-3"><StatValue label="平均手续费" value={`${stats.avgFee}%`} /></Card>
        <Card className="p-3"><StatValue label="平均成交延迟" value={`${stats.avgLatencyMs}ms`} /></Card>
        <Card className="p-3"><StatValue label="资金成本" value={`$${stats.fundingCost}`} /></Card>
        <Card className="p-3">
          <StatValue label="执行偏差" value={`+${stats.deviation}%`} tone="warn" />
        </Card>
      </div>

      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">执行日志</h3>
          <p className="text-xs text-muted">预期价格 vs 实际成交 · 自动计算执行偏差</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">订单</th>
                <th className="px-3 py-2 font-medium">方向</th>
                <th className="px-3 py-2 font-medium">预期</th>
                <th className="px-3 py-2 font-medium">实际</th>
                <th className="px-3 py-2 font-medium">滑点</th>
                <th className="px-3 py-2 font-medium">手续费</th>
                <th className="px-3 py-2 font-medium">延迟</th>
                <th className="px-3 py-2 font-medium">偏差</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const dev = ((o.actualPrice - o.expectedPrice) / o.expectedPrice) * 100;
                return (
                  <tr key={o.id} className="border-b border-border/60">
                    <td className="px-3 py-2.5 font-medium text-text">{o.symbol.replace("USDT", "")}</td>
                    <td className="px-3 py-2.5"><Badge tone={o.side === "LONG" ? "bull" : "bear"}>{SIDE_LABEL[o.side]}</Badge></td>
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