"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function SettingsPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="设置" subtitle="风控参数 / 交易偏好 / 自选列表" right={<DataSourceBadge />} />
      <SettingsPanel />
    </PageContainer>
  );
}