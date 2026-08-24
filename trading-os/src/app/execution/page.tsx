"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { ExecutionPanel } from "@/components/execution/ExecutionPanel";
import { Badge } from "@/components/ui/Badge";

export default function ExecutionPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle title="执行" subtitle="订单与执行质量：滑点 / 手续费 / 延迟 / 资金费率" right={<Badge tone="warn" dot>模拟模式</Badge>} />
      <ExecutionPanel />
    </PageContainer>
  );
}