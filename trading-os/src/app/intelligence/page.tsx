"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { IntelligenceList } from "@/components/intelligence/IntelligenceList";
import { AlertCenter } from "@/components/alerts/AlertCenter";
import { Badge } from "@/components/ui/Badge";

export default function IntelligencePage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="Intelligence" subtitle="市场情报与预警" right={<Badge tone="warn" dot>SIMULATION MODE</Badge>} />
      <div className="space-y-4">
        <IntelligenceList />
        <AlertCenter />
      </div>
    </PageContainer>
  );
}