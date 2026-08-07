"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap,
  Users,
  ArrowDownToLine,
  Flame,
  ArrowLeftRight,
  Fish,
  CandlestickChart,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { alphaSignals } from "@/lib/data";
import type { AlphaSignal, Direction } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreBar, Delta } from "@/components/ui/Badges";
import { SIGNAL_CATEGORY, dirColor, dirTextClass } from "@/lib/labels";
import { cn, fmtTimeAgo } from "@/lib/utils";

const ICONS: Record<string, any> = {
  Users,
  ArrowDownToLine,
  Flame,
  ArrowLeftRight,
  Fish,
  CandlestickChart,
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "全部信号" },
  { key: "bullish", label: "看多" },
  { key: "bearish", label: "看空" },
  { key: "kol-resonance", label: "KOL 共振" },
  { key: "onchain-flow", label: "链上资金" },
];

export function AlphaSignals() {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    return alphaSignals.filter((s) => {
      if (filter === "all") return true;
      if (filter === "bullish" || filter === "bearish") return s.direction === filter;
      return s.category === filter;
    });
  }, [filter]);

  const featured = alphaSignals[0];

  return (
    <section id="signals" className="scroll-mt-24">
      <SectionHeader
        index="01"
        icon={<Zap className="h-4 w-4" />}
        title="AI Alpha Signals"
        subtitle="AI 自动生成的可执行信号 · 综合可信 KOL、链上资金、情绪与衍生品"
        action={
          <div className="flex items-center gap-2">
            <span className="chip-signal">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />
              {alphaSignals.length} 条活跃
            </span>
            <button className="btn-ghost h-8 text-xs">查看历史信号</button>
          </div>
        }
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-all",
              filter === f.key
                ? "border-signal/50 bg-signal/10 text-signal"
                : "border-line bg-bg-elevated text-ink-low hover:border-line-strong hover:text-ink-mid"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <FeaturedSignal signal={featured} />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {filtered.slice(0, 4).map((s, i) => (
            <SignalCard key={s.id} signal={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedSignal({ signal }: { signal: AlphaSignal }) {
  const color = dirColor(signal.direction);
  const cat = SIGNAL_CATEGORY[signal.category];
  const Icon = ICONS[cat.icon] ?? Zap;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel hover className="group relative h-full overflow-hidden p-5">
        {/* glow border */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-60"
          style={{ boxShadow: `inset 0 0 0 1px ${color}33, 0 0 40px -10px ${color}55` }}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="chip-signal">
              <Sparkles className="h-3 w-3" /> 信号 #1 · 置顶
            </span>
            <span className="text-2xs text-ink-low tnum">{fmtTimeAgo(signal.ts)}</span>
          </div>

          <div className="mt-3 flex items-start gap-2">
            <span
              className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
              style={{ borderColor: `${color}40`, background: `${color}14`, color }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <h3 className="font-display text-lg font-semibold leading-tight text-ink-high">
              {signal.title}
            </h3>
          </div>

          {/* direction + confidence */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-bg-elevated/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-wider text-ink-low">方向</span>
                <span className={cn("text-sm font-semibold", dirTextClass(signal.direction))}>
                  {signal.direction === "bullish" ? "Bullish" : signal.direction === "bearish" ? "Bearish" : "Neutral"}
                </span>
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-mono text-3xl font-bold tnum" style={{ color }}>
                  {signal.confidence}
                </span>
                <span className="mb-1 text-2xs text-ink-low">置信度</span>
              </div>
              <ScoreBar value={signal.confidence} color={color} className="mt-2" />
            </div>
            <div className="rounded-lg border border-line bg-bg-elevated/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-2xs uppercase tracking-wider text-ink-low">强度</span>
                <span className="text-2xs text-ink-mid tnum">{signal.strength}/100</span>
              </div>
              <div className="mt-2 flex items-end gap-1">
                <span className="font-mono text-3xl font-bold text-ink-high tnum">{signal.winRate}%</span>
                <span className="mb-1 text-2xs text-ink-low">历史胜率</span>
              </div>
              <ScoreBar value={signal.strength} color="#5B9DFF" className="mt-2" />
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-line bg-bg-base/50 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-signal">
              <TrendingUp className="h-3 w-3" /> AI 依据
            </div>
            <p className="text-xs leading-relaxed text-ink-mid">{signal.basis}</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <Sparkline data={signal.spark} width={140} height={36} color={color} />
            <div className="flex flex-col items-end">
              <span className="text-2xs text-ink-low">历史平均收益</span>
              <Delta value={signal.avgReturn} className="text-base font-bold" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {signal.assets.map((a) => (
              <span key={a} className="chip-signal">{a}</span>
            ))}
            <span className="chip">+{signal.kols.length} KOL</span>
          </div>

          <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-bear/20 bg-bear/5 p-2.5">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bear" />
            <p className="text-2xs leading-relaxed text-bear/90">{signal.risk}</p>
          </div>

          <Link
            href={`/events/${signal.eventIds[0] ?? ""}`}
            className="mt-4 flex items-center justify-between rounded-lg border border-line bg-bg-elevated px-3 py-2 text-xs text-ink-mid transition-colors hover:border-signal/40 hover:text-signal"
          >
            <span>查看关联事件与传播网络</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Panel>
    </motion.div>
  );
}

function SignalCard({ signal, index }: { signal: AlphaSignal; index: number }) {
  const color = dirColor(signal.direction);
  const cat = SIGNAL_CATEGORY[signal.category];
  const Icon = ICONS[cat.icon] ?? Zap;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <Panel hover className="group flex h-full flex-col p-4">
        <div className="flex items-center justify-between">
          <span className="chip" style={{ borderColor: `${color}40`, color, background: `${color}10` }}>
            <Icon className="h-3 w-3" /> {cat.label}
          </span>
          <span className="text-2xs text-ink-low tnum">{fmtTimeAgo(signal.ts)}</span>
        </div>

        <h3 className="mt-2.5 text-sm font-semibold leading-snug text-ink-high">{signal.title}</h3>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-2xs text-ink-low">置信度</span>
            <span className="font-mono text-lg font-bold tnum" style={{ color }}>{signal.confidence}</span>
          </div>
          <div className="h-8 w-px bg-line" />
          <div className="flex flex-col">
            <span className="text-2xs text-ink-low">胜率</span>
            <span className="font-mono text-lg font-bold text-ink-high tnum">{signal.winRate}%</span>
          </div>
          <div className="h-8 w-px bg-line" />
          <div className="flex flex-col">
            <span className="text-2xs text-ink-low">均收</span>
            <Delta value={signal.avgReturn} className="font-mono text-lg font-bold" />
          </div>
          <div className="ml-auto">
            <Sparkline data={signal.spark} width={64} height={28} color={color} />
          </div>
        </div>

        <p className="mt-3 line-clamp-2 text-2xs leading-relaxed text-ink-low">{signal.basis}</p>

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="flex flex-wrap gap-1">
            {signal.assets.slice(0, 2).map((a) => (
              <span key={a} className="chip-signal text-[10px]">{a}</span>
            ))}
          </div>
          <span className={cn("text-2xs font-semibold", dirTextClass(signal.direction))}>
            {signal.direction === "bullish" ? "▲ Bullish" : signal.direction === "bearish" ? "▼ Bearish" : "● Neutral"}
          </span>
        </div>
      </Panel>
    </motion.div>
  );
}
