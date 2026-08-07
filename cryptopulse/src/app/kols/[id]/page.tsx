"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Trophy,
  Target,
  TrendingUp,
  Users,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { getKol } from "@/lib/data";
import type { Direction } from "@/lib/types";
import { Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreRing } from "@/components/ui/Gauge";
import { DirectionBadge, ScoreBar } from "@/components/ui/Badges";
import AccuracyChart from "@/components/charts/AccuracyChart";
import { dirColor, dirTextClass } from "@/lib/labels";
import { cn, fmtCompact } from "@/lib/utils";

const HISTORY = [
  { asset: "ETH", direction: "bullish" as Direction, return: 18.4, ts: "30天前", correct: true, view: "ETF 资金回暖是结构性强信号" },
  { asset: "BTC", direction: "bullish" as Direction, return: 9.2, ts: "14天前", correct: true, view: "交易所余额5年低点，前高可期" },
  { asset: "SOL", direction: "bearish" as Direction, return: -6.4, ts: "8天前", correct: true, view: "Meme 板块资金撤离拖累 SOL" },
  { asset: "PEPE", direction: "bullish" as Direction, return: -12.1, ts: "12天前", correct: false, view: "PEPE 突破在即" },
  { asset: "LINK", direction: "bullish" as Direction, return: 11.0, ts: "18天前", correct: true, view: "RWA 叙事利好 LINK" },
];

export default function KolDetailPage({ params }: { params: { id: string } }) {
  const kol = getKol(params.id);
  if (!kol) notFound();
  const [tab, setTab] = useState<"views" | "predictions" | "profile">("views");

  const scoreColor = kol.trustScore >= 85 ? "#2EE6A6" : kol.trustScore >= 75 ? "#16E6C8" : "#FFB020";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-2xs text-ink-low">
        <Link href="/" className="hover:text-signal">情报终端</Link><span>/</span>
        <Link href="/kols" className="hover:text-signal">KOL</Link><span>/</span>
        <span className="text-ink-mid">{kol.handle}</span>
      </div>

      {/* profile header */}
      <Panel className="relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-signal/10 blur-[90px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-signal/30 bg-gradient-to-br from-bg-elevated to-bg-base font-display text-xl font-bold text-signal">
            {kol.avatar}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-ink-high">{kol.name}</h1>
              <span className="font-mono text-sm text-ink-low">{kol.handle}</span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-mid">{kol.bio}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {kol.tags.map((t) => <span key={t} className="chip-signal">{t}</span>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-2xs text-ink-low">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {fmtCompact(kol.followers)} 粉丝</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {kol.posts} 文</span>
              <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> 平均互动 {fmtCompact(kol.avgEngagement)}</span>
              <span className="flex items-center gap-1"><Target className="h-3 w-3" /> {kol.predictions} 次预测</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <ScoreRing value={kol.trustScore} size={68} stroke={6} color={scoreColor} label="Trust" />
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing value={kol.influenceScore} size={68} stroke={6} color="#5B9DFF" label="Influence" />
            </div>
            <div className="flex flex-col items-center">
              <ScoreRing value={kol.accuracyScore} size={68} stroke={6} color="#A78BFA" label="Accuracy" />
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* left: tabs + content */}
        <div className="space-y-5">
          {/* tab nav */}
          <div className="flex gap-1 rounded-lg border border-line bg-bg-elevated p-1">
            {([["views", "近期观点"], ["predictions", "预测历史"], ["profile", "AI 人物画像"]] as const).map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  tab === k ? "bg-bg-base text-signal shadow-panel" : "text-ink-low hover:text-ink-mid"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "views" && (
            <Panel className="p-5">
              <div className="rounded-lg border border-signal/20 bg-signal/[0.04] p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-signal">
                  <Sparkles className="h-3 w-3" /> 最新观点
                </div>
                <p className="text-base leading-relaxed text-ink-high">{kol.recentView}</p>
              </div>
              <div className="mt-4 space-y-2">
                {HISTORY.slice(0, 3).map((h, i) => (
                  <ViewRow key={i} h={h} />
                ))}
              </div>
            </Panel>
          )}

          {tab === "predictions" && (
            <Panel className="overflow-hidden p-0">
              <div className="grid grid-cols-[1fr_80px_80px_80px_60px] gap-2 border-b border-line px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                <span>观点</span><span>标的</span><span>方向</span><span>收益</span><span>结果</span>
              </div>
              <div className="divide-y divide-line">
                {HISTORY.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[1fr_80px_80px_80px_60px] items-center gap-2 px-4 py-3 text-sm"
                  >
                    <span className="truncate text-ink-mid">{h.view}</span>
                    <span className="chip-signal w-fit text-[10px]">{h.asset}</span>
                    <DirectionBadge direction={h.direction} size="xs" />
                    <span className={cn("font-mono text-xs font-semibold tnum", h.return >= 0 ? "text-bull" : "text-bear")}>
                      {h.return >= 0 ? "+" : ""}{h.return}%
                    </span>
                    {h.correct ? <CheckCircle2 className="h-4 w-4 text-bull" /> : <XCircle className="h-4 w-4 text-bear" />}
                  </motion.div>
                ))}
              </div>
            </Panel>
          )}

          {tab === "profile" && (
            <Panel className="p-5">
              <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-signal">
                <Sparkles className="h-3 w-3" /> AI 人物画像
              </div>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-mid">
                <p>
                  <span className="text-ink-high">{kol.name}</span> 是一位
                  <span className="text-signal"> {kol.tags.join(" / ")}</span> 领域的中文 Crypto KOL，
                  拥有 {fmtCompact(kol.followers)} 粉丝，发文 {kol.posts} 条，平均互动 {fmtCompact(kol.avgEngagement)}。
                </p>
                <p>
                  历史共发表 {kol.predictions} 次预测，命中率 <span className="font-mono text-bull">{kol.hitRate}%</span>。
                  观点分布上偏 <span className={dirTextClass("bullish")}>看多 {kol.bullRatio}%</span> /
                  <span className={dirTextClass("bearish")}> 看空 {kol.bearRatio}%</span>，
                  {kol.bullRatio > 60 ? "整体偏多头视角，适合在上升趋势中参考。" : "多空相对均衡，观点较为客观。"}
                </p>
                <p>
                  综合评估：Trust Score <span className="font-mono text-signal">{kol.trustScore}</span>，
                  属于 <span className="text-ink-high">{kol.trustScore >= 85 ? "高可信" : kol.trustScore >= 75 ? "可信" : "中等可信"}</span> KOL。
                  {kol.accuracyScore >= 65 ? "预测准确率较高，可作为决策参考。" : "预测准确率一般，需结合其他信号交叉验证。"}
                </p>
              </div>
            </Panel>
          )}

          {/* top call */}
          {kol.topCall && (
            <Panel className="p-5">
              <div className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                <Trophy className="h-3 w-3 text-warn" /> 代表作
              </div>
              <div className="flex items-center gap-4 rounded-lg border border-line bg-bg-base/40 p-4">
                <div className="flex flex-col items-center">
                  <span className="chip-signal mb-2">{kol.topCall.asset}</span>
                  <DirectionBadge direction={kol.topCall.direction} />
                </div>
                <div className="h-12 w-px bg-line" />
                <div className="flex-1">
                  <div className="text-2xs text-ink-low">累计收益</div>
                  <div className={cn("font-mono text-3xl font-bold tnum", kol.topCall.return >= 0 ? "text-bull" : "text-bear")}>
                    {kol.topCall.return >= 0 ? "+" : ""}{kol.topCall.return}%
                  </div>
                </div>
                <Sparkline data={kol.spark} width={120} height={48} color={dirColor(kol.topCall.direction)} />
              </div>
            </Panel>
          )}
        </div>

        {/* right: accuracy + stats */}
        <div className="space-y-5">
          <Panel className="p-5">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-ink-high">预测准确率走势</h3>
              <span className="font-mono text-lg font-bold text-signal tnum">{kol.hitRate}%</span>
            </div>
            <p className="text-2xs text-ink-low">滚动 30 次预测命中率</p>
            <div className="mt-2">
              <AccuracyChart hitRate={kol.hitRate} />
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-high">观点分布</h3>
            <div className="mb-1.5 flex justify-between text-2xs">
              <span className="text-bull">看多 {kol.bullRatio}%</span>
              <span className="text-bear">看空 {kol.bearRatio}%</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-bear/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${kol.bullRatio}%` }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-bull"
              />
            </div>
            <div className="mt-4 space-y-2.5">
              <ScoreRow label="Trust Score" value={kol.trustScore} color="#2EE6A6" />
              <ScoreRow label="Influence Score" value={kol.influenceScore} color="#5B9DFF" />
              <ScoreRow label="Accuracy Score" value={kol.accuracyScore} color="#A78BFA" />
              <ScoreRow label="命中率" value={kol.hitRate} color="#16E6C8" />
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-ink-high">关注板块</h3>
            <div className="flex flex-wrap gap-1.5">
              {kol.tags.map((t) => <span key={t} className="chip">{t}</span>)}
              <span className="chip">量化信号源</span>
              <span className="chip">长期追踪</span>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ViewRow({ h }: { h: { asset: string; direction: Direction; return: number; ts: string; view: string; correct: boolean } }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-bg-base/40 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-mid">{h.view}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="chip-signal text-[10px]">{h.asset}</span>
          <DirectionBadge direction={h.direction} size="xs" />
          <span className="text-2xs text-ink-faint">{h.ts}</span>
        </div>
      </div>
      <div className="text-right">
        <div className={cn("font-mono text-sm font-semibold tnum", h.return >= 0 ? "text-bull" : "text-bear")}>
          {h.return >= 0 ? "+" : ""}{h.return}%
        </div>
        {h.correct ? <CheckCircle2 className="ml-auto mt-1 h-3.5 w-3.5 text-bull" /> : <XCircle className="ml-auto mt-1 h-3.5 w-3.5 text-bear" />}
      </div>
    </div>
  );
}

function ScoreRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-2xs">
        <span className="text-ink-mid">{label}</span>
        <span className="font-mono text-ink-high tnum">{value}</span>
      </div>
      <ScoreBar value={value} color={color} height={5} />
    </div>
  );
}
