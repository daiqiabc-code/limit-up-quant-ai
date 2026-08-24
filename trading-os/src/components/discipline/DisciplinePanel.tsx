"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function DisciplinePanel() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const discipline = snapshot?.discipline ?? [];
  const avg = discipline.length
    ? Math.round(discipline.reduce((s, d) => s + d.disciplineScore, 0) / discipline.length)
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-text">交易纪律评分</h3>
            <p className="text-xs text-muted">近 7 日纪律均分</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn("text-3xl font-bold", avg >= 90 ? "text-bull" : avg >= 75 ? "text-warn" : "text-bear")}>
              {avg}
            </div>
            <span className="text-sm text-muted">/100</span>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text">每日记录</h3>
          <p className="text-xs text-muted">是否遵循系统 / 过度交易 / 违反风控 / 冲动入场</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">日期</th>
                <th className="px-3 py-2 font-medium">遵循系统</th>
                <th className="px-3 py-2 font-medium">过度交易</th>
                <th className="px-3 py-2 font-medium">违反风控</th>
                <th className="px-3 py-2 font-medium">冲动入场</th>
                <th className="px-3 py-2 font-medium">评分</th>
              </tr>
            </thead>
            <tbody>
              {discipline.map((d) => (
                <tr key={d.date} className="border-b border-border/60">
                  <td className="px-3 py-2.5 text-text">{d.date}</td>
                  <Cell value={d.followedSystem} />
                  <Cell value={!d.overtraded} />
                  <Cell value={!d.violatedRiskRules} />
                  <Cell value={!d.enteredByFomo} />
                  <td className="px-3 py-2.5">
                    <span className={cn("num font-semibold", d.disciplineScore >= 90 ? "text-bull" : d.disciplineScore >= 75 ? "text-warn" : "text-bear")}>
                      {d.disciplineScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Cell({ value }: { value: boolean }) {
  return (
    <td className="px-3 py-2.5">
      <span className={cn("text-xs font-semibold", value ? "text-bull" : "text-bear")}>
        {value ? "是" : "否"}
      </span>
    </td>
  );
}