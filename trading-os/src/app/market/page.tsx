"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { MarketRegimeCard } from "@/components/overview/MarketRegimeCard";
import { BtcChart } from "@/components/market/BtcChart";
import { SignalSummary } from "@/components/market/SignalSummary";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function MarketPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="行情" subtitle="市场状态与核心图表" right={<DataSourceBadge />} />
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