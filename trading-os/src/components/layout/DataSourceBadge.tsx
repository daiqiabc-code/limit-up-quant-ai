"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Badge } from "@/components/ui/Badge";
import type { DataSource } from "@/types";

const META: Record<DataSource, { label: string; tone: "bull" | "warn" | "neutral" }> = {
  MOCK: { label: "模拟数据", tone: "neutral" },
  LIVE_OKX: { label: "OKX 实时", tone: "bull" },
  LIVE_BINANCE: { label: "Binance 实时", tone: "bull" },
  FALLBACK: { label: "实时降级", tone: "warn" },
};

export function DataSourceBadge() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const ds = snapshot?.dataSource ?? "MOCK";
  const live = snapshot?.liveTradingEnabled ?? false;
  const meta = META[ds] ?? META.MOCK;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={meta.tone} dot>{meta.label}</Badge>
      {live && <Badge tone="bear" dot>真实交易</Badge>}
    </span>
  );
}