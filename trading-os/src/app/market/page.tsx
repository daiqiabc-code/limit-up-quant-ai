"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { MarketRegimeCard } from "@/components/overview/MarketRegimeCard";
import { BtcChart } from "@/components/market/BtcChart";
import { SignalSummary } from "@/components/market/SignalSummary";
import { Badge } from "@/components/ui/Badge";

export default function MarketPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="行情" subtitle="市场状态与核心图表" right={<Badge tone="warn" dot>模拟模式</Badge>} />
      <div className="space-y-4">
        <MarketRegimeCard regime={snapshot.regime} />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="xl:col-span-3"><BtcChart /></div>
          <SignalSummary />
        </div>
      </div>
    </PageContainer>
  );
}