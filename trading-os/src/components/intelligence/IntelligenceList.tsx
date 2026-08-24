"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { tfAgo } from "@/lib/utils";

export function IntelligenceList() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const events = snapshot?.marketEvents ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3 text-xs text-purple-300">
        情报模块预留接口，未来接入 X / Telegram / 新闻 / 链上数据 / ETF / 宏观 / 资金费率 / OI / 清算数据。当前为模拟事件。
      </div>

      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">Top Market Events</h3>
          <p className="text-xs text-muted">按影响力排序</p>
        </div>
        <div className="space-y-2">
          {events.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
              <span className="text-lg font-bold text-muted">{i + 1}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-text">{e.title}</div>
                <div className="text-[11px] text-muted">{e.source} · {tfAgo(e.occurredAt)}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={e.impact === "BULLISH" ? "bull" : e.impact === "BEARISH" ? "bear" : "neutral"}>
                  {e.impact}
                </Badge>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted">Confidence</span>
                  <span className="num text-xs font-semibold text-text">{e.confidence}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}