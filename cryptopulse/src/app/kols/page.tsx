"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, ArrowUpRight, ArrowUpDown } from "lucide-react";
import { kols } from "@/lib/data";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { ScoreRing } from "@/components/ui/Gauge";
import { Sparkline } from "@/components/ui/Sparkline";
import { DirectionBadge } from "@/components/ui/Badges";
import { cn, fmtCompact } from "@/lib/utils";

type SortKey = "trustScore" | "influenceScore" | "accuracyScore" | "hitRate" | "followers";

export default function KolsPage() {
  const [sort, setSort] = useState<SortKey>("trustScore");

  const sorted = [...kols].sort((a, b) => b[sort] - a[sort]);

  const cols: { key: SortKey; label: string }[] = [
    { key: "trustScore", label: "Trust" },
    { key: "influenceScore", label: "Influence" },
    { key: "accuracyScore", label: "Accuracy" },
    { key: "hitRate", label: "命中率" },
    { key: "followers", label: "粉丝" },
  ];

  return (
    <div className="space-y-5">
      <SectionHeader index="" icon={<Trophy className="h-4 w-4" />} title="KOL 数据库" subtitle="长期画像 · Trust / Influence / Accuracy 三维评分 · 点击列头排序" />

      <Panel className="overflow-hidden p-0">
        <div className="hidden grid-cols-[1.8fr_0.7fr_repeat(5,0.8fr)_1fr] gap-2 border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint md:grid">
          <span>KOL</span>
          <span>代表作</span>
          {cols.map((c) => (
            <button key={c.key} onClick={() => setSort(c.key)} className="flex items-center gap-1 text-left hover:text-signal">
              {c.label}
              <ArrowUpDown className={cn("h-2.5 w-2.5", sort === c.key ? "text-signal" : "text-ink-faint")} />
            </button>
          ))}
          <span className="text-right">趋势</span>
        </div>
        <div className="divide-y divide-line">
          {sorted.map((k, i) => {
            const scoreColor = k.trustScore >= 85 ? "#2EE6A6" : k.trustScore >= 75 ? "#16E6C8" : "#FFB020";
            return (
              <Link key={k.id} href={`/kols/${k.id}`} className="group grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-bg-hover md:grid-cols-[1.8fr_0.7fr_repeat(5,0.8fr)_1fr] md:items-center">
                <div className="flex items-center gap-3">
                  <span className="w-4 text-center font-mono text-2xs text-ink-faint tnum">{i + 1}</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg-elevated font-display text-2xs font-bold text-signal">{k.avatar}</div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{k.name}</div>
                    <div className="truncate font-mono text-2xs text-ink-low">{k.handle}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {k.topCall && (
                    <>
                      <span className="chip-signal text-[10px]">{k.topCall.asset}</span>
                      <DirectionBadge direction={k.topCall.direction} size="xs" />
                    </>
                  )}
                </div>
                <ScoreMini value={k.trustScore} active={sort === "trustScore"} color={scoreColor} />
                <ScoreMini value={k.influenceScore} active={sort === "influenceScore"} color="#5B9DFF" />
                <ScoreMini value={k.accuracyScore} active={sort === "accuracyScore"} color="#A78BFA" />
                <ScoreMini value={k.hitRate} active={sort === "hitRate"} color="#16E6C8" suffix="%" />
                <div className="font-mono text-sm text-ink-mid tnum">{fmtCompact(k.followers)}</div>
                <div className="flex items-center justify-end gap-2">
                  <Sparkline data={k.spark} width={60} height={26} color="#16E6C8" />
                  <ArrowUpRight className="h-3.5 w-3.5 text-ink-low opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function ScoreMini({ value, color, active, suffix = "" }: { value: number; color: string; active?: boolean; suffix?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5", active && "text-signal")}>
      <span className="font-mono text-sm font-semibold text-ink-high tnum">{value}{suffix}</span>
      <div className="hidden h-1 w-10 overflow-hidden rounded-full bg-bg-elevated lg:block">
        <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
