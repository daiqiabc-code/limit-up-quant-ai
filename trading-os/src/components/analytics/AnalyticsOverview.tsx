"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { StatValue } from "@/components/ui/State";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { cn, formatUsd } from "@/lib/utils";

const RANGES = ["7D", "30D", "90D", "YTD", "ALL"] as const;

// 确定性 equity 曲线
const CURVE = [
  { t: "Jan", equity: 10000 },
  { t: "Feb", equity: 10800 },
  { t: "Mar", equity: 10300 },
  { t: "Apr", equity: 11200 },
  { t: "May", equity: 11900 },
  { t: "Jun", equity: 11500 },
  { t: "Jul", equity: 12100 },
  { t: "Aug", equity: 12580 },
];

export function AnalyticsOverview() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const [range, setRange] = useState<(typeof RANGES)[number]>("30D");
  if (!snapshot) return null;
  const a = snapshot.analytics;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Analytics 复盘</h2>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r ? "bg-white/10 text-text" : "text-muted hover:bg-white/5",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Metric label="Win Rate" value={`${a.winRate}%`} tone="bull" />
        <Metric label="Profit Factor" value={a.profitFactor.toFixed(2)} tone="bull" />
        <Metric label="Expectancy" value={`${a.expectancy}R`} tone="bull" />
        <Metric label="Avg R" value={a.avgR.toFixed(2)} />
        <Metric label="Sharpe" value={a.sharpe.toFixed(2)} />
        <Metric label="Avg Win" value={formatUsd(a.avgWin)} tone="bull" />
        <Metric label="Avg Loss" value={formatUsd(a.avgLoss)} tone="bear" />
        <Metric label="Max Drawdown" value={`${a.maxDrawdown}%`} tone="warn" />
        <Metric label="Calmar" value={a.calmar.toFixed(2)} />
        <Metric label="Net PnL" value={formatUsd(a.netPnl)} tone="bull" />
      </div>

      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">Equity Curve</h3>
          <p className="text-xs text-muted">账户净值曲线（模拟）</p>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CURVE} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="t" stroke="#475569" fontSize={11} />
              <YAxis stroke="#475569" fontSize={11} tickFormatter={(v) => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid #1F2937", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94A3B8" }}
                itemStyle={{ color: "#F9FAFB" }}
              />
              <Area type="monotone" dataKey="equity" stroke="#22C55E" fill="url(#eq)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" | "warn" }) {
  return (
    <Card className="p-3">
      <StatValue label={label} value={value} tone={tone} />
    </Card>
  );
}