// =============================================================
// S / A / B / C 分级页面
// 按层级 Tab 展示，右侧展示层级定义
// =============================================================
import { useMemo, useState } from "react";
import { useCryptoStore } from "../store";
import { CoinTable } from "../components/CoinTable";
import { Panel } from "../components/ui";
import { GRADE_LABELS } from "../lib/config/narratives";
import type { Grade } from "../lib/types";

const TABS: { value: Grade; label: string; color: string; desc: string; crit: string[] }[] = [
  {
    value: "S",
    label: "S 级",
    color: "text-violet-400",
    desc: "必须盯",
    crit: ["强势 + 热门 + 新资金", "新叙事", "成交活跃", "相对 BTC 强"],
  },
  {
    value: "A",
    label: "A 级",
    color: "text-blue-400",
    desc: "值得跟踪",
    crit: ["趋势较强", "相对强势", "流动性好", "有资金关注，未完全爆发"],
  },
  {
    value: "B",
    label: "B 级",
    color: "text-cyan-400",
    desc: "事件驱动观察",
    crit: ["基本面/生态不错", "叙事成立", "趋势一般", "等待催化剂"],
  },
  {
    value: "C",
    label: "C 级",
    color: "text-slate-400",
    desc: "删除",
    crit: ["YTD 为负 / 跑输 BTC", "成交量下降", "Holder 停滞", "Smart Money 流出 / 无催化"],
  },
];

export default function Grades() {
  const coins = useCryptoStore((s) => s.coins);
  const [tab, setTab] = useState<Grade>("S");

  const filtered = useMemo(
    () => coins.filter((c) => c.grade === tab).sort((a, b) => b.finalScore - a.finalScore),
    [coins, tab],
  );
  const counts = useMemo(() => {
    const m: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0 };
    for (const c of coins) m[c.grade]++;
    return m;
  }, [coins]);

  const active = TABS.find((t) => t.value === tab)!;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] transition-colors ${
              tab === t.value
                ? "border-terminal-border2 bg-terminal-panel2 text-terminal-bright"
                : "border-terminal-border text-terminal-muted hover:text-terminal-fg"
            }`}
          >
            <span className={`font-bold ${t.color}`}>{t.label}</span>
            <span className="tabular-nums text-terminal-muted">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      <Panel title={`${GRADE_LABELS[active.value]} · ${active.desc}`}>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-terminal-muted">
          {active.crit.map((c) => (
            <li key={c} className="flex items-center gap-1"><span className="text-emerald-400">·</span>{c}</li>
          ))}
        </ul>
      </Panel>

      <CoinTable coins={filtered} emptyText="该层级暂无币种" />
    </div>
  );
}