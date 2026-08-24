"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tfAgo } from "@/lib/utils";
import { Bell, TrendingUp, ShieldAlert, Activity } from "lucide-react";
import { ALERT_TYPE_LABEL, ALERT_STATUS_LABEL } from "@/lib/labels";
import type { AlertType } from "@/types";

const TYPE_META: Record<AlertType, { tone: "bull" | "warn" | "bear" | "info"; icon: React.ReactNode }> = {
  PRICE: { tone: "info", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  SIGNAL: { tone: "bull", icon: <Activity className="h-3.5 w-3.5" /> },
  RISK: { tone: "warn", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  SYSTEM: { tone: "bear", icon: <Bell className="h-3.5 w-3.5" /> },
};

export function AlertCenter() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const alerts = snapshot?.alerts ?? [];
  const activeCount = alerts.filter((a) => a.status === "ACTIVE").length;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">预警中心</h3>
        <Badge tone="warn">{activeCount} 条活跃</Badge>
      </div>
      <div className="space-y-2">
        {alerts.map((a) => {
          const meta = TYPE_META[a.type];
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <Badge tone={meta.tone}>{meta.icon}{ALERT_TYPE_LABEL[a.type]}</Badge>
              <div className="flex-1 text-sm text-text">{a.message}</div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted">{tfAgo(a.createdAt)}</span>
                <Badge tone={a.status === "ACTIVE" ? "bull" : "neutral"}>{ALERT_STATUS_LABEL[a.status]}</Badge>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}