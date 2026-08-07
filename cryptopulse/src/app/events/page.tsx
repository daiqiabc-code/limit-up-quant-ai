"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Layers, ArrowUpRight, Search } from "lucide-react";
import { events } from "@/lib/data";
import type { Importance } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { ImportanceBadge, DirectionBadge } from "@/components/ui/Badges";
import { Sparkline } from "@/components/ui/Sparkline";
import { SECTOR_COLORS, dirColor } from "@/lib/labels";
import { cn, fmtTimeAgo, fmtCompact } from "@/lib/utils";

const IMPORTANCE_FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
];

export default function EventsPage() {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return [...events]
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .filter((e) => (filter === "all" ? true : e.importance === filter))
      .filter((e) => (q ? (e.title + e.summary + e.assets.join("")).toLowerCase().includes(q.toLowerCase()) : true));
  }, [filter, q]);

  return (
    <div className="space-y-5">
      <SectionHeader index="" icon={<Layers className="h-4 w-4" />} title="事件数据库" subtitle="AI 按事件聚类 · 全量归档 · 持续追踪结果" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg-elevated px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-ink-low" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索事件 / 标的 / 板块"
            className="w-48 bg-transparent text-sm text-ink placeholder:text-ink-low focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5">
          {IMPORTANCE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-all",
                filter === f.key ? "border-signal/50 bg-signal/10 text-signal" : "border-line bg-bg-elevated text-ink-low hover:text-ink-mid"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-2xs text-ink-low">{filtered.length} 个事件</span>
      </div>

      <div className="space-y-3">
        {filtered.map((e, i) => {
          const color = dirColor(e.direction);
          return (
            <Link key={e.id} href={`/events/${e.id}`}>
              <Panel hover className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="flex w-12 shrink-0 flex-col items-center sm:w-16">
                  <span className="font-mono text-2xs text-ink-faint">评分</span>
                  <span className="font-mono text-xl font-bold text-ink-high tnum">{e.importanceScore}</span>
                  <ImportanceBadge importance={e.importance} />
                </div>
                <div className="h-px w-full bg-line sm:h-12 sm:w-px" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold text-ink-high group-hover:text-signal">{e.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-mid">{e.summary}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {e.sectors.slice(0, 3).map((s) => (
                      <span key={s} className="chip text-[10px]" style={{ borderColor: `${SECTOR_COLORS[s]}40`, color: SECTOR_COLORS[s] }}>{s}</span>
                    ))}
                    {e.assets.map((a) => <span key={a} className="chip-signal text-[10px]">{a}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <DirectionBadge direction={e.direction} />
                  <div className="hidden text-right sm:block">
                    <div className="text-2xs text-ink-low">触达 / 推文</div>
                    <div className="font-mono text-xs text-ink-mid tnum">{fmtCompact(e.reach)} · {fmtCompact(e.tweetCount)}</div>
                  </div>
                  <Sparkline data={e.spark} width={64} height={32} color={color} />
                  <div className="text-right">
                    <div className="text-2xs text-ink-low">24h</div>
                    <span className={cn("font-mono text-sm font-semibold tnum", e.outcome["24h"] >= 0 ? "text-bull" : "text-bear")}>
                      {e.outcome["24h"] >= 0 ? "+" : ""}{e.outcome["24h"].toFixed(1)}%
                    </span>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-low transition-transform group-hover:translate-x-0.5" />
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
