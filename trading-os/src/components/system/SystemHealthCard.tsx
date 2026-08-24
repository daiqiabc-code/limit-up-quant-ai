"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SYSTEM_STATUS_LABEL, systemStatusTone } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Activity, ShieldCheck, Database, Target } from "lucide-react";

export function SystemHealthCard() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return null;
  const h = snapshot.systemHealth;

  const metrics = [
    { label: "30D PF", value: h.pf30d.toFixed(2), status: h.pf30d >= 1 ? "GOOD" : "BAD" },
    { label: "90D PF", value: h.pf90d.toFixed(2), status: h.pf90d >= 1 ? "GOOD" : "BAD" },
    { label: "Current Drawdown", value: `${h.currentDrawdown}%`, status: h.currentDrawdown < 4 ? "GOOD" : h.currentDrawdown < 6 ? "WARN" : "BAD" },
    { label: "Rule Compliance", value: `${h.ruleCompliance}%`, status: h.ruleCompliance >= 90 ? "GOOD" : h.ruleCompliance >= 80 ? "WARN" : "BAD" },
    { label: "Execution Quality", value: `${h.executionQuality}%`, status: h.executionQuality >= 90 ? "GOOD" : "WARN" },
    { label: "Data Quality", value: `${h.dataQuality}%`, status: "GOOD" },
  ];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">System Health</h3>
          <Badge tone="bull" dot>{h.strategyStatus === "ACTIVE" ? "ACTIVE" : "PAUSED"}</Badge>
        </div>
        <Badge tone={systemStatusTone(h.status)}>{SYSTEM_STATUS_LABEL[h.status]}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-surface p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted">{m.label}</div>
            <div
              className={cn(
                "num mt-1 text-lg font-semibold",
                m.status === "GOOD" ? "text-bull" : m.status === "WARN" ? "text-warn" : "text-bear",
              )}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {h.warnings.length > 0 && (
        <div className="mt-3 space-y-1 rounded-lg border border-warn/30 bg-warn/5 p-3">
          <div className="text-[11px] font-medium text-warn">自动预警</div>
          {h.warnings.map((w, i) => (
            <div key={i} className="text-xs text-muted">• {w}</div>
          ))}
        </div>
      )}
    </Card>
  );
}