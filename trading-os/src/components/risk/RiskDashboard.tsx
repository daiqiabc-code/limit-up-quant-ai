"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { StatValue } from "@/components/ui/State";
import { RISK_STATUS_LABEL, riskStatusTone } from "@/lib/labels";
import { cn, formatUsd } from "@/lib/utils";

export function RiskDashboard() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;
  const r = snapshot.risk;

  const statusTone = riskStatusTone(r.status);
  const statusColor =
    statusTone === "bull" ? "#22C55E" : statusTone === "warn" ? "#F59E0B" : "#EF4444";

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">账户权益</div>
            <div className="num mt-1 text-3xl font-bold text-text">${r.accountEquity.toLocaleString()}</div>
          </div>
          <div className="flex flex-col items-center rounded-lg px-4 py-2" style={{ backgroundColor: `${statusColor}14` }}>
            <div className="text-[10px] uppercase tracking-wide text-muted">风险状态</div>
            <div className="text-2xl font-bold" style={{ color: statusColor }}>
              {RISK_STATUS_LABEL[r.status]}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="可用保证金" value={formatUsd(r.availableMargin)} />
        <Metric label="敞口" value={`${r.exposure}%`} />
        <Metric label="组合热度" value={`${r.portfolioHeat}%`} tone={statusTone === "bull" ? "bull" : statusTone} />
        <Metric label="爆仓距离" value={`${r.liquidationDistance}%`} />
        <Metric label="日风险" value={`${r.dailyRisk}%`} />
        <Metric label="周风险" value={`${r.weeklyRisk}%`} />
        <Metric label="最大回撤" value={`${r.maxDrawdown}%`} />
        <Metric label="当前回撤" value={`${r.currentDrawdown}%`} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "warn" | "bear";
}) {
  return (
    <Card className="p-3">
      <StatValue label={label} value={value} tone={tone} />
    </Card>
  );
}

export function PortfolioHeat() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;
  const rows = snapshot.heatContributions;
  const total = snapshot.risk.portfolioHeat;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">组合热度</h3>
        <span className="num text-lg font-bold text-text">{total}%</span>
      </div>
      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = (r.heat / Math.max(total, 0.01)) * 100;
          return (
            <div key={r.symbol}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted">{r.symbol.replace("USDT", "")}</span>
                <span className="num text-text">{r.heat}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-bull"
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted">
        定义：所有开放交易最大潜在亏损 / 账户权益
      </div>
    </Card>
  );
}