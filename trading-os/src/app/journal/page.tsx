"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { JournalPanel } from "@/components/journal/JournalPanel";
import { DisciplinePanel } from "@/components/discipline/DisciplinePanel";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function JournalPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="日志" subtitle="交易日志与纪律评分" right={<DataSourceBadge />} />
      <div className="space-y-6">
        <JournalPanel />
        <DisciplinePanel />
      </div>
    </PageContainer>
  );
}