"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { REGIME_LABEL_ZH, regimeTone } from "@/lib/labels";
import { Badge } from "@/components/ui/Badge";

export function StrategyPerformanceList() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const strategies = snapshot?.strategies ?? [];

  return (
    <div className="space-y-4">
      {strategies.map((s) => (
        <Card key={s.id}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text">{s.name}</h3>
              <p className="text-xs text-muted">{s.symbol.replace("USDT", "")} · {s.trades} 笔</p>
            </div>
            <Badge tone={s.profitFactor >= 1.5 ? "bull" : s.profitFactor >= 1 ? "warn" : "bear"}>
              盈亏比 {s.profitFactor.toFixed(2)}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Mini label="胜率" value={`${s.winRate}%`} />
            <Mini label="平均盈利" value={`+${s.avgWinner}R`} tone="bull" />
            <Mini label="平均亏损" value={`${s.avgLoser}R`} tone="bear" />
            <Mini label="期望" value={`+${s.expectancy}R`} />
            <Mini label="最大回撤" value={`${s.maxDrawdown}%`} />
          </div>

          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted">按市场状态拆分</div>
            <div className="flex flex-wrap gap-2">
              {s.byRegime.map((r) => (
                <div key={r.regime} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5">
                  <Badge tone={regimeTone(r.regime)}>{REGIME_LABEL_ZH[r.regime]}</Badge>
                  <span className="num text-sm font-semibold text-text">{r.profitFactor.toFixed(2)}</span>
                  <span className="text-[10px] text-muted">{r.trades}笔</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs text-info">
            结论：{s.verdict}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "bull" | "bear" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={cn("num mt-0.5 text-sm font-semibold", tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-text")}>
        {value}
      </div>
    </div>
  );
}