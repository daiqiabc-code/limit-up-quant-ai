"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { ACTION_LABEL, actionTone, REGIME_LABEL, regimeTone, riskTone, RISK_LABEL, TREND_LABEL, SETUP_LABEL } from "@/lib/labels";
import { formatPrice, formatPct } from "@/lib/utils";

export function OpportunityDrawer() {
  const opp = useTradingStore((s) => s.activeOpportunity);
  const openOpportunity = useTradingStore((s) => s.openOpportunity);
  const openSignalDetail = useTradingStore((s) => s.openSignalDetail);

  return (
    <Drawer
      open={!!opp}
      onClose={() => openOpportunity(null)}
      title={opp ? `${opp.symbol.replace("USDT", "")} — 交易机会` : ""}
      subtitle={opp ? opp.name : ""}
    >
      {opp && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="市场状态" value={<Badge tone={regimeTone(opp.regime.state)}>{REGIME_LABEL[opp.regime.state]}</Badge>} />
            <Field label="趋势" value={TREND_LABEL[opp.trend]} />
            <Field label="信号评分" value={<span className="text-lg font-bold text-text">{opp.score}</span>} />
            <Field label="形态" value={SETUP_LABEL[opp.setup]} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] uppercase text-muted">入场</div>
                <div className="num text-sm font-semibold text-text">{formatPrice(opp.entry)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted">止损</div>
                <div className="num text-sm font-semibold text-bear">{formatPrice(opp.stop)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-muted">目标</div>
                <div className="num text-sm font-semibold text-bull">{formatPrice(opp.target)}</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
              <Field label="盈亏比" value={opp.riskReward.toFixed(1)} />
              <Field
                label="风险"
                value={<Badge tone={riskTone(opp.risk)}>{RISK_LABEL[opp.risk]}</Badge>}
              />
              <Field
                label="操作"
                value={<Badge tone={actionTone(opp.action)}>{ACTION_LABEL[opp.action]}</Badge>}
              />
            </div>
          </div>

          <div>
            <div className="mb-1 text-[11px] uppercase text-muted">理由</div>
            <p className="text-sm leading-relaxed text-text">{opp.reason}</p>
          </div>

          <button
            onClick={() => openSignalDetail(opp.symbol)}
            className="w-full rounded-lg border border-info/40 bg-info/10 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20"
          >
            查看完整信号评分逻辑
          </button>
        </div>
      )}
    </Drawer>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm text-text">{value}</div>
    </div>
  );
}