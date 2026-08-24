"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function ExecutionPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="执行" subtitle="订单与执行质量：滑点 / 手续费 / 延迟 / 资金费率" right={<DataSourceBadge />} />
      <ExecutionPanel />
    </PageContainer>
  );
}