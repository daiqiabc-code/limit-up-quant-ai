"use client";

import { useTradingStore } from "@/store/tradingStore";
import { PageContainer, PageTitle } from "@/components/layout/PageTitle";
import { TodayAction } from "@/components/overview/TodayAction";
import { MarketRegimeCard } from "@/components/overview/MarketRegimeCard";
import { BtcChart } from "@/components/market/BtcChart";
import { SignalSummary } from "@/components/market/SignalSummary";
import { OpportunityScanner } from "@/components/opportunities/OpportunityScanner";
import { OpportunityDrawer } from "@/components/opportunities/OpportunityDrawer";
import { SignalDetailDrawer } from "@/components/opportunities/SignalDetailDrawer";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { RiskDashboard, PortfolioHeat } from "@/components/risk/RiskDashboard";
import { SystemHealthCard } from "@/components/system/SystemHealthCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/State";
import { tfAgo } from "@/lib/utils";

export default function OverviewPage() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const loading = useTradingStore((s) => s.loading);

  if (!snapshot && loading) {
    return (
      <PageContainer>
        <LoadingState label="正在加载模拟行情…" />
      </PageContainer>
    );
  }
  if (!snapshot) return null;

  return (
    <PageContainer>
      <PageTitle
        title="Overview"
        subtitle="市场是什么状态 → 哪里有机会 → 承担多少风险 → 今天做还是等"
        right={
          <div className="flex items-center gap-2">
            <Badge tone="warn" dot>SIMULATION MODE</Badge>
            <Badge tone="neutral">Updated {tfAgo(snapshot.updatedAt)}</Badge>
          </div>
        }
      />

      <div className="space-y-4">
        <TodayAction />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MarketRegimeCard regime={snapshot.regime} />
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <QuickStat label="Valid Setups" value={Object.values(snapshot.signals).filter((s) => s.action === "LONG").length} />
            <QuickStat label="Portfolio Heat" value={`${snapshot.risk.portfolioHeat}%`} tone={snapshot.risk.portfolioHeat < 2 ? "bull" : "warn"} />
            <QuickStat label="Risk Status" value={snapshot.risk.status} tone="bull" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <BtcChart />
          </div>
          <SignalSummary />
        </div>

        <OpportunityScanner />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">Open Positions</h3>
              <Badge tone="neutral">{snapshot.positions.length}</Badge>
            </div>
            <PositionsTable compact />
          </Card>
          <PortfolioHeat />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-text">Risk Snapshot</h3>
            <RiskDashboard />
          </div>
          <SystemHealthCard />
        </div>
      </div>

      <OpportunityDrawer />
      <SignalDetailDrawer />
    </PageContainer>
  );
}

function QuickStat({ label, value, tone }: { label: string; value: string | number; tone?: "bull" | "warn" }) {
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular ${tone === "bull" ? "text-bull" : tone === "warn" ? "text-warn" : "text-text"}`}>
        {value}
      </div>
    </Card>
  );
}