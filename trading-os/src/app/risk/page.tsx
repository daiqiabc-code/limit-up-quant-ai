"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { RiskDashboard, PortfolioHeat } from "@/components/risk/RiskDashboard";
import { Badge } from "@/components/ui/Badge";

export default function RiskPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="Risk" subtitle="风控中枢：最大潜在亏损 / 账户权益" right={<Badge tone="warn" dot>SIMULATION MODE</Badge>} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><RiskDashboard /></div>
        <PortfolioHeat />
      </div>
    </PageContainer>
  );
}