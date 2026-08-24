"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { OpportunityScanner } from "@/components/opportunities/OpportunityScanner";
import { OpportunityDrawer } from "@/components/opportunities/OpportunityDrawer";
import { SignalDetailDrawer } from "@/components/opportunities/SignalDetailDrawer";
import { Badge } from "@/components/ui/Badge";

export default function OpportunitiesPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle
        title="机会"
        subtitle="机会扫描：排序 / 搜索 / 过滤 / 点击查看完整评分"
        right={<Badge tone="warn" dot>模拟模式</Badge>}
      />
      <OpportunityScanner />
      <OpportunityDrawer />
      <SignalDetailDrawer />
    </PageContainer>
  );
}