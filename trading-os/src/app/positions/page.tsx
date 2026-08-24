"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { Card } from "@/components/ui/Card";
import { DataSourceBadge } from "@/components/layout/DataSourceBadge";

export default function PositionsPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  if (!snapshot) return <PageContainer />;

  return (
    <PageContainer>
      <PageTitle
        title="持仓"
        subtitle="当前持仓 · 阶段一按钮仅模拟（Paper）"
        right={<DataSourceBadge />}
      />
      <Card>
        <PositionsTable />
      </Card>
      <p className="mt-3 text-xs text-muted">
        不支持真实下单。减仓、平仓、移动止损、加仓均为模拟交互，真实交易默认关闭。
      </p>
    </PageContainer>
  );
}