import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Users,
  Radio,
  MessageSquare,
  TrendingUp,
  Brain,
  ShieldAlert,
  Eye,
  Clock,
  Share2,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";
import { events, getEvent, getKol, kols } from "@/lib/data";
import { Panel } from "@/components/ui/Section";
import { ImportanceBadge, DirectionBadge, ScoreBar } from "@/components/ui/Badges";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreRing } from "@/components/ui/Gauge";
import { PropagationGraph } from "@/components/charts/PropagationGraph";
import OutcomeChart from "@/components/charts/OutcomeChart";
import { SECTOR_COLORS, dirColor } from "@/lib/labels";
import { cn, fmtTime, fmtTimeAgo, fmtCompact } from "@/lib/utils";

export function generateStaticParams() {
  return events.map((e) => ({ id: e.id }));
}

const STATUS_MAP: Record<string, string> = {
  developing: "发酵中",
  peaked: "已达峰",
  fading: "降温中",
  realized: "已兑现",
};

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const event = getEvent(params.id);
  if (!event) notFound();

  const color = dirColor(event.direction);
  const relatedKols = event.kols.map(getKol).filter(Boolean) as NonNullable<ReturnType<typeof getKol>>[];
  const relatedEvents = events.filter((e) => event.relatedEvents.includes(e.id));

  const importanceFactors = [
    { label: "传播速度", value: event.velocity },
    { label: "传播人数", value: Math.min(100, Math.round(event.reach / 3200)) },
    { label: "影响范围", value: Math.min(100, event.kolCount * 3) },
    { label: "权威程度", value: Math.min(100, 60 + event.kolCount) },
    { label: "价格影响", value: Math.min(100, Math.abs(event.outcome["24h"]) * 12) },
    { label: "资金流", value: Math.min(100, 50 + event.outcome["24h"] * 6) },
  ];

  return (
    <div className="space-y-5">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-2xs text-ink-low">
        <Link href="/" className="hover:text-signal">情报终端</Link>
        <span>/</span>
        <Link href="/events" className="hover:text-signal">事件</Link>
        <span>/</span>
        <span className="text-ink-mid">{event.id}</span>
      </div>

      {/* header */}
      <Panel className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[100px]" style={{ background: `${color}18` }} />
        <div className="relative">
          <Link href="/events" className="inline-flex items-center gap-1 text-xs text-ink-low transition-colors hover:text-signal">
            <ArrowLeft className="h-3.5 w-3.5" /> 返回事件列表
          </Link>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ImportanceBadge importance={event.importance} />
            <DirectionBadge direction={event.direction} />
            <span className="chip"><span className="h-1.5 w-1.5 rounded-full bg-signal" />{STATUS_MAP[event.status]}</span>
            <span className="chip font-mono tnum">{fmtTime(event.ts)}</span>
            <span className="text-2xs text-ink-low">· {fmtTimeAgo(event.ts)}</span>
            <div className="ml-auto flex gap-1.5">
              <button className="btn-ghost h-8 text-xs"><Share2 className="h-3.5 w-3.5" />分享</button>
              <button className="btn h-8 text-xs"><Eye className="h-3.5 w-3.5" />关注</button>
            </div>
          </div>

          <h1 className="mt-3 font-display text-2xl font-bold leading-tight text-ink-high sm:text-3xl">
            {event.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-mid">{event.summary}</p>

          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {event.sectors.map((s) => (
              <span key={s} className="chip" style={{ borderColor: `${SECTOR_COLORS[s]}40`, color: SECTOR_COLORS[s], background: `${SECTOR_COLORS[s]}10` }}>{s}</span>
            ))}
            {event.assets.map((a) => <span key={a} className="chip-signal">{a}</span>)}
          </div>

          {/* quick stats */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickStat icon={<Gauge className="h-4 w-4" />} label="重要性评分" value={`${event.importanceScore}`} accent={color} />
            <QuickStat icon={<Radio className="h-4 w-4" />} label="传播速度" value={`${event.velocity}`} accent="#16E6C8" />
            <QuickStat icon={<Users className="h-4 w-4" />} label="触达人数" value={fmtCompact(event.reach)} accent="#5B9DFF" />
            <QuickStat icon={<MessageSquare className="h-4 w-4" />} label="关联推文" value={fmtCompact(event.tweetCount)} accent="#A78BFA" />
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* AI deep analysis */}
        <Panel className="p-5">
          <SectionTitle icon={<Brain className="h-4 w-4" />} title="AI 深度分析" chip="AI 生成" />
          <div className="mt-3 rounded-lg border border-signal/20 bg-signal/[0.04] p-3">
            <p className="text-sm leading-relaxed text-ink-high">
              <span className="text-signal">一句话总结 · </span>{event.aiAnalysis.oneLiner}
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AnalysisBlock label="背景介绍" body={event.aiAnalysis.background} />
            <AnalysisBlock label="未来展望" body={event.aiAnalysis.outlook} accent="#16E6C8" />
            <AnalysisBlock label="利多逻辑" body={event.aiAnalysis.bullCase} accent="#2EE6A6" />
            <AnalysisBlock label="利空逻辑" body={event.aiAnalysis.bearCase} accent="#FF5C7A" />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-bear/20 bg-bear/5 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-bear" />
            <div>
              <div className="text-2xs font-semibold uppercase tracking-wider text-bear">风险提示</div>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-mid">{event.aiAnalysis.risk}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-low">
              <Eye className="h-3 w-3" /> 重点观察指标
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.aiAnalysis.watch.map((w) => (
                <span key={w} className="chip-signal">{w}</span>
              ))}
            </div>
          </div>
        </Panel>

        {/* Importance breakdown */}
        <Panel className="p-5">
          <SectionTitle icon={<Gauge className="h-4 w-4" />} title="AI 重要性评分" chip={`${event.importanceScore}`} />
          <div className="mt-4 flex justify-center">
            <ScoreRing value={event.importanceScore} size={120} stroke={9} color={color} label="综合" />
          </div>
          <div className="mt-4 space-y-2.5">
            {importanceFactors.map((f) => (
              <div key={f.label}>
                <div className="mb-1 flex justify-between text-2xs">
                  <span className="text-ink-mid">{f.label}</span>
                  <span className="font-mono text-ink-high tnum">{Math.round(f.value)}</span>
                </div>
                <ScoreBar value={f.value} color={f.value >= 70 ? "#16E6C8" : f.value >= 40 ? "#FFB020" : "#FF5C7A"} height={5} />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-line bg-bg-base/40 p-2.5 text-2xs leading-relaxed text-ink-low">
            综合传播速度、传播人数、影响范围、权威程度、历史类似事件、价格影响与资金流自动加权计算。
          </div>
        </Panel>
      </div>

      {/* Timeline + Outcome */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle icon={<Clock className="h-4 w-4" />} title="事件时间轴" />
          <div className="mt-4 space-y-0">
            {event.timeline.map((t, i) => {
              const last = i === event.timeline.length - 1;
              return (
                <div key={i} className="relative flex gap-3 pb-5 last:pb-0">
                  {!last && <div className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                  <span className={cn("relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border", last ? "border-signal bg-signal/20" : "border-line bg-bg-base")}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", last ? "bg-signal" : "bg-ink-low")} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-2xs text-signal tnum">{t.label}</span>
                      <span className="font-mono text-2xs text-ink-faint">{fmtTime(t.ts)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-mid">{t.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<TrendingUp className="h-4 w-4" />} title="事件结果追踪" chip="1h / 24h / 7d / 30d / 90d" />
          <div className="mt-3">
            <OutcomeChart outcome={event.outcome} direction={event.direction} />
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {([["1h", event.outcome["1h"]], ["24h", event.outcome["24h"]], ["7d", event.outcome["7d"]], ["30d", event.outcome["30d"]], ["90d", event.outcome["90d"]]] as const).map(([l, v]) => (
              <div key={l} className="rounded-lg border border-line bg-bg-base/40 p-2 text-center">
                <div className="text-2xs text-ink-low">{l}</div>
                <div className={cn("mt-0.5 font-mono text-xs font-semibold tnum", v === 0 ? "text-ink-faint" : v >= 0 ? "text-bull" : "text-bear")}>
                  {v === 0 ? "待" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Propagation */}
      <Panel className="p-5">
        <SectionTitle icon={<Radio className="h-4 w-4" />} title="信息传播分析" chip="首发 → 放大 → 传播 → 破圈" />
        <p className="mt-1 text-xs text-ink-low">网络关系图 · 中文圈 / 英文圈传播路径 · 拖拽节点可重新布局</p>
        <div className="mt-3">
          <PropagationGraph height={340} />
        </div>
      </Panel>

      {/* Related KOLs + events */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <SectionTitle icon={<Users className="h-4 w-4" />} title={`关联 KOL（${event.kolCount}）`} />
          <div className="mt-3 space-y-2">
            {relatedKols.map((k) => (
              <Link key={k.id} href={`/kols/${k.id}`} className="group flex items-center gap-3 rounded-lg border border-line bg-bg-base/40 p-2.5 transition-colors hover:border-signal/30 hover:bg-bg-hover">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg-elevated font-display text-2xs font-bold text-signal">{k.avatar}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{k.name}</div>
                  <div className="truncate font-mono text-2xs text-ink-low">{k.handle}</div>
                </div>
                <Sparkline data={k.spark} width={56} height={22} color="#16E6C8" />
                <ScoreRing value={k.trustScore} size={36} stroke={3.5} color="#2EE6A6" />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <SectionTitle icon={<Sparkles className="h-4 w-4" />} title="关联事件" />
          <div className="mt-3 space-y-2">
            {relatedEvents.length === 0 && <p className="text-xs text-ink-low">暂无关联事件。</p>}
            {relatedEvents.map((e) => (
              <Link key={e.id} href={`/events/${e.id}`} className="group flex items-center gap-3 rounded-lg border border-line bg-bg-base/40 p-3 transition-colors hover:border-signal/30 hover:bg-bg-hover">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{e.title}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ImportanceBadge importance={e.importance} />
                    <span className="text-2xs text-ink-faint">{fmtTimeAgo(e.ts)}</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-ink-low transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
            <div className="rounded-lg border border-dashed border-line bg-bg-base/20 p-3">
              <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">关联 KOL 集体观点</div>
              <div className="flex items-center gap-2">
                <DirectionBadge direction={event.direction} />
                <span className="text-2xs text-ink-low">看多 {Math.round(event.sentiment * 0.7)}% · 看空 {Math.round((100 - event.sentiment) * 0.6)}%</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-base/40 p-3">
      <div className="flex items-center gap-1.5 text-2xs text-ink-low" style={{ color: accent }}>{icon}{label}</div>
      <div className="mt-1 font-mono text-xl font-bold text-ink-high tnum">{value}</div>
    </div>
  );
}

function SectionTitle({ icon, title, chip }: { icon: React.ReactNode; title: string; chip?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-bg-elevated text-signal">{icon}</span>
        <h2 className="font-display text-base font-semibold text-ink-high">{title}</h2>
      </div>
      {chip && <span className="chip-signal">{chip}</span>}
    </div>
  );
}

function AnalysisBlock({ label, body, accent = "#9AA7BC" }: { label: string; body: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-base/40 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />{label}
      </div>
      <p className="text-xs leading-relaxed text-ink-mid">{body}</p>
    </div>
  );
}
