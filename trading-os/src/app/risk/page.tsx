"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { RiskDashboard, PortfolioHeat } from "@/components/risk/RiskDashboard";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function RiskPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="风控" subtitle="风控中枢：最大潜在亏损 / 账户权益" right={<DataSourceBadge />} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><RiskDashboard /></div>
        <PortfolioHeat />
      </div>
    </PageContainer>
  );
}