"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Badge } from "@/components/ui/Badge";

export default function SettingsPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="Settings" subtitle="风控参数 / 交易偏好 / Watchlist" right={<Badge tone="warn" dot>SIMULATION MODE</Badge>} />
      <SettingsPanel />
    </PageContainer>
  );
}