"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { StrategyPerformanceList } from "@/components/strategies/StrategyPerformanceList";
import { SystemHealthCard } from "@/components/system/SystemHealthCard";
import { Badge } from "@/components/ui/Badge";

export default function StrategiesPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="Strategies" subtitle="策略绩效：按市场状态拆分，找出有效环境" right={<Badge tone="warn" dot>SIMULATION MODE</Badge>} />
      <div className="space-y-6">
        <StrategyPerformanceList />
        <SystemHealthCard />
      </div>
    </PageContainer>
  );
}