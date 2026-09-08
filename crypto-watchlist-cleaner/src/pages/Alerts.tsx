// =============================================================
// Alerts —— 数据与价格预警
// =============================================================
import { useMemo } from "react";
import { Bell, ArrowUp, TrendingUp, Skull, RotateCcw } from "lucide-react";
import { useCryptoStore } from "../store";
import { Panel, Badge } from "../components/ui";
import { fmtTime } from "../lib/utils/format";
import type { Alert } from "../lib/types";

const LEVEL_META: Record<Alert["level"], { label: string; tone: "red" | "amber" | "blue" | "green"; icon: typeof Bell }> = {
  critical: { label: "删除信号", tone: "red", icon: Skull },
  warn: { label: "警告", tone: "amber", icon: ArrowUp },
  info: { label: "动量", tone: "blue", icon: TrendingUp },
  recovery: { label: "反转", tone: "green", icon: RotateCcw },
};

export default function Alerts() {
  const alerts = useCryptoStore((s) => s.alerts);

  const grouped = useMemo(() => {
    const m: Record<Alert["level"], Alert[]> = { critical: [], warn: [], info: [], recovery: [] };
    for (const a of alerts) m[a.level].push(a);
    return m;
  }, [alerts]);

  const order: Alert["level"][] = ["critical", "recovery", "warn", "info"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-terminal-bright">预警中心</h2>
        <Badge tone="slate">{alerts.length} 条</Badge>
      </div>

      {alerts.length === 0 && (
        <Panel>
          <div className="py-10 text-center text-[12px] text-terminal-muted">暂无预警</div>
        </Panel>
      )}

      {order.map((level) => {
        const list = grouped[level];
        if (list.length === 0) return null;
        const meta = LEVEL_META[level];
        const Icon = meta.icon;
        return (
          <Panel key={level} title={<span className="inline-flex items-center gap-2"><Icon size={15} /> {meta.label}</span>}>
            <div className="divide-y divide-terminal-border/60">
              {list.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Badge tone={meta.tone}>{a.symbol}</Badge>
                    {a.ai && <Badge tone="violet">AI</Badge>}
                    <span className="truncate text-[13px] text-terminal-fg">{a.message}</span>
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-terminal-muted">{fmtTime(a.time)}</span>
                </div>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}