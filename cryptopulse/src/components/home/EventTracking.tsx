"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Target, CheckCircle2, XCircle, MinusCircle, ArrowUpRight } from "lucide-react";
import { events } from "@/lib/data";
import type { Event } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { DirectionBadge } from "@/components/ui/Badges";
import { cn } from "@/lib/utils";

// Historical resolved events (full 90d outcome) for the tracking database
const historical: (Event & { aiVerdict: "correct" | "partial" | "wrong"; kolVerdict: "correct" | "partial" | "wrong" })[] = [
  {
    id: "h-1",
    title: "BTC 现货 ETF 首日获批交易",
    summary: "BTC 现货 ETF 获批首日，市场预期兑现，AI 与多数 KOL 看多。",
    importance: "critical",
    importanceScore: 98,
    sentiment: 74,
    direction: "bullish",
    sectors: ["BTC", "ETF"],
    assets: ["BTC"],
    ts: Date.now() - 80 * 86400_000,
    reach: 0, velocity: 0, kolCount: 0, tweetCount: 0,
    status: "realized",
    aiAnalysis: { oneLiner: "", background: "", bullCase: "", bearCase: "", outlook: "", risk: "", watch: [] },
    timeline: [],
    outcome: { "1h": 1.2, "24h": 6.8, "7d": 12.4, "30d": 18.2, "90d": 24.6 },
    kols: [], relatedEvents: [],
    spark: [80, 82, 85, 88, 90, 95, 100],
    aiVerdict: "correct",
    kolVerdict: "correct",
  },
  {
    id: "h-2",
    title: "SOL 链上 Meme 热潮见顶预警",
    summary: "AI 在 Pump.fun 收入见顶时发出看空 Meme 信号，部分 KOL 仍看多。",
    importance: "high",
    importanceScore: 76,
    sentiment: 38,
    direction: "bearish",
    sectors: ["Meme", "SOL"],
    assets: ["PEPE", "WIF"],
    ts: Date.now() - 45 * 86400_000,
    reach: 0, velocity: 0, kolCount: 0, tweetCount: 0,
    status: "realized",
    aiAnalysis: { oneLiner: "", background: "", bullCase: "", bearCase: "", outlook: "", risk: "", watch: [] },
    timeline: [],
    outcome: { "1h": -0.8, "24h": -5.4, "7d": -14.2, "30d": -22.6, "90d": -31.4 },
    kols: [], relatedEvents: [],
    spark: [100, 98, 92, 86, 78, 70, 62],
    aiVerdict: "correct",
    kolVerdict: "partial",
  },
  {
    id: "h-3",
    title: "ETH Dencun 升级利好落地",
    summary: "ETH Dencun 升级前 AI 看多，但升级后 L2 费用骤降引发抛售，短期转跌。",
    importance: "high",
    importanceScore: 72,
    sentiment: 64,
    direction: "bullish",
    sectors: ["ETH", "Layer2"],
    assets: ["ETH"],
    ts: Date.now() - 60 * 86400_000,
    reach: 0, velocity: 0, kolCount: 0, tweetCount: 0,
    status: "realized",
    aiAnalysis: { oneLiner: "", background: "", bullCase: "", bearCase: "", outlook: "", risk: "", watch: [] },
    timeline: [],
    outcome: { "1h": 0.6, "24h": 2.1, "7d": -3.4, "30d": -8.2, "90d": 4.6 },
    kols: [], relatedEvents: [],
    spark: [100, 102, 104, 99, 94, 96, 104],
    aiVerdict: "partial",
    kolVerdict: "wrong",
  },
];

const verdictMap = {
  correct: { label: "判断正确", icon: CheckCircle2, cls: "text-bull border-bull/30 bg-bull/5" },
  partial: { label: "部分正确", icon: MinusCircle, cls: "text-warn border-warn/30 bg-warn/5" },
  wrong: { label: "判断错误", icon: XCircle, cls: "text-bear border-bear/30 bg-bear/5" },
} as const;

const PERIODS: (keyof Event["outcome"])[] = ["1h", "24h", "7d", "30d", "90d"];

export function EventTracking() {
  const totalResolved = historical.length;
  const aiCorrect = historical.filter((h) => h.aiVerdict === "correct").length;
  const aiPartial = historical.filter((h) => h.aiVerdict === "partial").length;
  const aiScore = Math.round(((aiCorrect + aiPartial * 0.5) / totalResolved) * 100);
  const kolCorrect = historical.filter((h) => h.kolVerdict === "correct").length;
  const kolScore = Math.round((kolCorrect / totalResolved) * 100);

  return (
    <section id="tracking" className="scroll-mt-24">
      <SectionHeader
        index="06"
        icon={<Target className="h-4 w-4" />}
        title="事件结果追踪"
        subtitle="每个事件永久保存 · 1h / 24h / 7d / 30d / 90d 自动跟踪 · AI 与 KOL 判断复盘"
      />

      {/* summary */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="已归档事件" value={`${totalResolved + events.length}`} sub="持续累积" color="#16E6C8" />
        <SummaryStat label="AI 预测准确率" value={`${aiScore}%`} sub={`${aiCorrect}/${totalResolved} 命中`} color="#2EE6A6" />
        <SummaryStat label="KOL 集体准确率" value={`${kolScore}%`} sub={`${kolCorrect}/${totalResolved} 命中`} color="#5B9DFF" />
        <SummaryStat label="平均兑现周期" value="3.4d" sub="信号→兑现" color="#A78BFA" />
      </div>

      <Panel className="mt-4 overflow-hidden p-0">
        {/* header */}
        <div className="hidden grid-cols-[2fr_0.8fr_repeat(5,1fr)_1.2fr] gap-2 border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint md:grid">
          <span>事件</span>
          <span>方向</span>
          {PERIODS.map((p) => <span key={p} className="text-center">{p}</span>)}
          <span className="text-right">复盘</span>
        </div>

        <div className="divide-y divide-line">
          {historical.map((e, i) => (
            <TrackingRow key={e.id} event={e} index={i} resolved />
          ))}
          {events.slice(0, 3).map((e, i) => (
            <TrackingRow key={e.id} event={e} index={i + historical.length} />
          ))}
        </div>
      </Panel>
    </section>
  );
}

function TrackingRow({
  event,
  index,
  resolved,
}: {
  event: any;
  index: number;
  resolved?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <Link href={`/events/${event.id}`} className="group grid grid-cols-1 gap-2 px-4 py-3 transition-colors hover:bg-bg-hover md:grid-cols-[2fr_0.8fr_repeat(5,1fr)_1.2fr] md:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{event.title}</span>
            {resolved && <span className="chip text-[9px]">已归档</span>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-low">
            {event.assets.map((a: string) => <span key={a} className="text-signal/80">{a}</span>)}
            {!resolved && <span className="text-ink-faint">· 追踪中</span>}
          </div>
        </div>

        <DirectionBadge direction={event.direction} size="xs" />

        {PERIODS.map((p) => {
          const v = event.outcome[p];
          const pending = !resolved && v === 0;
          const up = v >= 0;
          const mag = Math.min(1, Math.abs(v) / 25);
          return (
            <div key={p} className="flex flex-col items-center">
              <span className={cn("font-mono text-xs font-semibold tnum", pending ? "text-ink-faint" : up ? "text-bull" : "text-bear")}>
                {pending ? "—" : `${up ? "+" : ""}${v.toFixed(1)}%`}
              </span>
              {!pending && (
                <div className="mt-1 h-1 w-10 overflow-hidden rounded-full bg-bg-elevated">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${mag * 100}%`, background: up ? "#2EE6A6" : "#FF5C7A" }}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-start gap-1 md:justify-end">
          {resolved ? (
            <>
              <VerdictChip role="AI" verdict={event.aiVerdict} />
              <VerdictChip role="KOL" verdict={event.kolVerdict} />
            </>
          ) : (
            <span className="chip text-[9px]"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />追踪中</span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function VerdictChip({ role, verdict }: { role: string; verdict: "correct" | "partial" | "wrong" }) {
  const v = verdictMap[verdict];
  const Icon = v.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium", v.cls)}>
      <Icon className="h-2.5 w-2.5" />
      {role}
    </span>
  );
}

function SummaryStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <Panel className="p-3">
      <div className="text-2xs uppercase tracking-wider text-ink-low">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold tnum" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-2xs text-ink-faint">{sub}</div>
    </Panel>
  );
}
