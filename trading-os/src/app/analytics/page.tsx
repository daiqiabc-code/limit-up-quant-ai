"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { AnalyticsOverview } from "@/components/analytics/AnalyticsOverview";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function AnalyticsPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="复盘" subtitle="统计复盘：胜率 / 盈亏比 / 期望 / 夏普 / 回撤" right={<DataSourceBadge />} />
      <AnalyticsOverview />
    </PageContainer>
  );
}