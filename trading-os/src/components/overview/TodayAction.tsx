"use client";

import { useTradingStore, getTodayAction, buildOpportunities } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { REGIME_LABEL, REGIME_LABEL_ZH, regimeTone, riskStatusTone, RISK_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { TrendingUp, Activity, Flame, ShieldCheck, ArrowRight } from "lucide-react";

export function TodayAction() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;

  const action = getTodayAction(snapshot);
  const opps = buildOpportunities(snapshot);
  const validSetups = opps.filter((o) => o.action === "LONG" || o.action === "WATCH").length;
  const top = opps.slice(0, 2).map((o) => o.base ?? o.symbol.replace("USDT", ""));

  const config = {
    TRADE: { dot: "🟢", label: "TRADE", tone: "bull" as const, note: "存在高质量多头机会，可执行" },
    WAIT: { dot: "🟡", label: "WAIT", tone: "warn" as const, note: "等待更强信号或回踩确认" },
    NO_TRADE: { dot: "🔴", label: "NO TRADE", tone: "bear" as const, note: "风险过高或信号不足，停手" },
  }[action];

  return (
    <Card className="relative overflow-hidden">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="text-4xl leading-none">{config.dot}</div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Today&apos;s Action</div>
            <div
              className={cn(
                "mt-1 text-3xl font-bold tracking-tight",
                config.tone === "bull" ? "text-bull" : config.tone === "warn" ? "text-warn" : "text-bear",
              )}
            >
              {config.label}
            </div>
            <div className="mt-1 text-xs text-muted">{config.note}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Metric
            icon={<Activity className="h-4 w-4 text-muted" />}
            label="Market Regime"
            value={REGIME_LABEL[snapshot.regime.state]}
            badge={<Badge tone={regimeTone(snapshot.regime.state)} dot>{REGIME_LABEL_ZH[snapshot.regime.state]}</Badge>}
          />
          <Metric
            icon={<TrendingUp className="h-4 w-4 text-muted" />}
            label="Valid Setups"
            value={String(validSetups)}
          />
          <Metric
            icon={<Flame className="h-4 w-4 text-muted" />}
            label="Portfolio Heat"
            value={`${snapshot.risk.portfolioHeat}%`}
          />
          <Metric
            icon={<ShieldCheck className="h-4 w-4 text-muted" />}
            label="Risk Status"
            value={RISK_STATUS_LABEL[snapshot.risk.status]}
            valueClass={cn(
              snapshot.risk.status === "SAFE"
                ? "text-bull"
                : snapshot.risk.status === "CAUTION"
                  ? "text-warn"
                  : "text-bear",
            )}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs text-muted">
        <span className="font-medium text-text">Priority</span>
        {top.map((t, i) => (
          <span key={t} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted/50" />}
            <span className="font-mono text-text">{t}</span>
          </span>
        ))}
      </div>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  valueClass,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[11px] text-muted">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 text-base font-semibold tabular", valueClass ?? "text-text")}>{value}</div>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
  );
}