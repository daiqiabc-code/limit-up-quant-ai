"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Layers,
  Gauge,
  Radio,
  Users,
  MessageSquare,
  ArrowUpRight,
  TrendingUp,
  Circle,
} from "lucide-react";
import { events } from "@/lib/data";
import type { Event, Importance } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { ImportanceBadge, DirectionBadge } from "@/components/ui/Badges";
import { SECTOR_COLORS, dirColor } from "@/lib/labels";
import { cn, fmtTimeAgo, fmtCompact } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  developing: { label: "发酵中", cls: "text-signal" },
  peaked: { label: "已达峰", cls: "text-warn" },
  fading: { label: "降温中", cls: "text-ink-low" },
  realized: { label: "已兑现", cls: "text-ink-mid" },
};

export function EventClusters() {
  const sorted = [...events].sort((a, b) => b.importanceScore - a.importanceScore);
  return (
    <section id="events" className="scroll-mt-24">
      <SectionHeader
        index="02"
        icon={<Layers className="h-4 w-4" />}
        title="24 小时重要事件"
        subtitle="AI 按事件聚类 · 自动评分、情绪判定与影响范围追踪"
        action={
          <Link href="/events" className="btn-ghost h-8 text-xs">
            全部事件 <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mt-4 space-y-3">
        {sorted.map((e, i) => (
          <EventRow key={e.id} event={e} index={i} />
        ))}
      </div>
    </section>
  );
}

function importanceColor(imp: Importance) {
  return imp === "critical" ? "#FF5C7A" : imp === "high" ? "#FFB020" : imp === "medium" ? "#5B9DFF" : "#5C6A80";
}

function EventRow({ event, index }: { event: Event; index: number }) {
  const ic = importanceColor(event.importance);
  const st = STATUS_MAP[event.status];
  const color = dirColor(event.direction);
  const isFeatured = index === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
    >
      <Link href={`/events/${event.id}`} className="block">
        <Panel hover className="group relative overflow-hidden p-0">
          {/* left importance rail */}
          <div className="flex">
            <div
              className="hidden w-1.5 shrink-0 sm:block"
              style={{ background: `linear-gradient(180deg, ${ic}, ${ic}22)` }}
            />
            <div className="min-w-0 flex-1 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <ImportanceBadge importance={event.importance} />
                <span
                  className="chip"
                  style={{ borderColor: `${ic}40`, color: ic, background: `${ic}10` }}
                >
                  <Gauge className="h-3 w-3" /> 评分 {event.importanceScore}
                </span>
                <DirectionBadge direction={event.direction} />
                <span className={cn("chip text-[10px]", "border-line")}>
                  <Circle className="h-2 w-2 fill-current" /> {st.label}
                </span>
                <span className="ml-auto text-2xs text-ink-low tnum">{fmtTimeAgo(event.ts)}</span>
              </div>

              <div className="mt-3 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold leading-snug text-ink-high transition-colors group-hover:text-signal lg:text-lg">
                    {event.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-mid">
                    {event.summary}
                  </p>

                  {/* AI one-liner */}
                  <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-signal/15 bg-signal/[0.04] px-2.5 py-1.5">
                    <span className="mt-0.5 text-signal">▍</span>
                    <p className="text-xs leading-relaxed text-ink-mid">
                      <span className="text-signal">AI 摘要 · </span>
                      {event.aiAnalysis.oneLiner}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {event.sectors.map((s) => (
                      <span
                        key={s}
                        className="chip"
                        style={{ borderColor: `${SECTOR_COLORS[s]}40`, color: SECTOR_COLORS[s], background: `${SECTOR_COLORS[s]}10` }}
                      >
                        {s}
                      </span>
                    ))}
                    {event.assets.map((a) => (
                      <span key={a} className="chip-signal text-[10px]">{a}</span>
                    ))}
                  </div>
                </div>

                {/* right stats column */}
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat icon={<Users className="h-3 w-3" />} label="触达" value={fmtCompact(event.reach)} />
                    <Stat icon={<Radio className="h-3 w-3" />} label="传播" value={`${event.velocity}`} />
                    <Stat icon={<MessageSquare className="h-3 w-3" />} label="推文" value={fmtCompact(event.tweetCount)} />
                  </div>

                  {/* outcome preview */}
                  <div className="rounded-lg border border-line bg-bg-base/50 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-2xs uppercase tracking-wider text-ink-low">事件结果追踪</span>
                      <TrendingUp className="h-3 w-3 text-ink-low" />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex flex-1 items-end justify-between gap-2">
                        <Outcome label="1h" value={event.outcome["1h"]} />
                        <Outcome label="24h" value={event.outcome["24h"]} />
                        <Outcome label="7d" value={event.outcome["7d"]} />
                        <Outcome label="30d" value={event.outcome["30d"]} muted />
                      </div>
                      <Sparkline data={event.spark} width={70} height={32} color={color} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-2xs text-ink-low">
                    <span>关联 {event.kolCount} 位 KOL · {event.tweetCount} 条推文</span>
                    <span className="inline-flex items-center gap-1 text-signal opacity-0 transition-opacity group-hover:opacity-100">
                      分析 <ArrowUpRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </div>

              {/* mini timeline for featured */}
              {isFeatured && (
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">事件时间轴</div>
                  <div className="relative flex items-start justify-between gap-2">
                    <div className="absolute left-2 right-2 top-1.5 h-px bg-line" />
                    {event.timeline.map((t, i) => (
                      <div key={i} className="relative z-10 flex flex-1 flex-col items-center text-center">
                        <span className="flex h-3 w-3 items-center justify-center rounded-full border border-signal bg-bg-base">
                          <span className="h-1 w-1 rounded-full bg-signal" />
                        </span>
                        <span className="mt-1.5 text-2xs font-mono text-ink-low">{t.label}</span>
                        <span className="mt-0.5 line-clamp-1 max-w-[120px] text-2xs text-ink-faint">{t.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </Link>
    </motion.div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-base/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-ink-faint">{icon}<span className="text-2xs">{label}</span></div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-ink-high tnum">{value}</div>
    </div>
  );
}

function Outcome({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  const up = value >= 0;
  return (
    <div className="flex flex-col">
      <span className="text-2xs text-ink-low">{label}</span>
      <span className={cn("font-mono text-xs font-semibold tnum", muted ? "text-ink-faint" : up ? "text-bull" : "text-bear")}>
        {muted ? "—" : `${up ? "+" : ""}${value.toFixed(1)}%`}
      </span>
    </div>
  );
}
