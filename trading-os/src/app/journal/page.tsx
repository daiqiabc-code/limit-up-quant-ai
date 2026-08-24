"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { JournalPanel } from "@/components/journal/JournalPanel";
import { DisciplinePanel } from "@/components/discipline/DisciplinePanel";
import { Badge } from "@/components/ui/Badge";

export default function JournalPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="Journal" subtitle="交易日志与纪律评分" right={<Badge tone="warn" dot>SIMULATION MODE</Badge>} />
      <div className="space-y-6">
        <JournalPanel />
        <DisciplinePanel />
      </div>
    </PageContainer>
  );
}