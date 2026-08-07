"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Download,
  Image as ImageIcon,
  Share2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Flame,
  Trophy,
} from "lucide-react";
import { events, kols, projects, sentiments } from "@/lib/data";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { ImportanceBadge, DirectionBadge, Delta } from "@/components/ui/Badges";
import { SentimentGauge } from "@/components/ui/Gauge";
import { Sparkline } from "@/components/ui/Sparkline";
import { SECTOR_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export default function DailyPage() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const top10 = [...events].sort((a, b) => b.importanceScore - a.importanceScore).slice(0, 10);
  const topKols = [...kols].sort((a, b) => b.trustScore - a.trustScore).slice(0, 5);
  const hotProjects = [...projects].sort((a, b) => b.heat - a.heat).slice(0, 5);
  const overall = sentiments[0];

  return (
    <div className="space-y-5">
      {/* header */}
      <Panel className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-signal/10 blur-[100px]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="chip-signal"><Calendar className="h-3 w-3" /> AI 日报</span>
              <span className="font-mono text-2xs text-ink-low tnum">{dateStr}</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold text-ink-high">CryptoPulse 每日情报</h1>
            <p className="mt-1 text-sm text-ink-low">AI 自动生成 · 今日十大事件 / 市场总结 / 热点板块 / 风险提示</p>
          </div>
          <div className="flex gap-2">
            <button className="btn h-9 text-xs"><Download className="h-3.5 w-3.5" /> PDF</button>
            <button className="btn h-9 text-xs"><ImageIcon className="h-3.5 w-3.5" /> 图片分享</button>
            <button className="btn-primary h-9 text-xs"><Share2 className="h-3.5 w-3.5" /> 分享</button>
          </div>
        </div>
      </Panel>

      {/* market summary */}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Panel className="p-5">
          <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="市场总结" />
          <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-mid">
            <p>
              <span className="text-signal">▍今日核心：</span>
              BTC 突破 96000 逼近前高，ETH 现货 ETF 资金流入创近两月新高引发 KOL 共振看多，Hyperliquid 板块热度暴涨 312% 成为最强主线。
            </p>
            <p>
              <span className="text-signal">▍资金面：</span>
              交易所 BTC 余额降至 5 年低点，长期持有者占比 74%，现货 ETF 连续 5 日净流入累计 +18.4 亿美元。稳定币净流出 4.2 亿美元，Meme 板块购买力减弱。
            </p>
            <p>
              <span className="text-signal">▍板块轮动：</span>
              资金由 Meme 向主流币与 RWA 迁移，Pump.fun 收入较高点下滑 62%，RWA 板块受机构与监管双重催化走强。
            </p>
          </div>
        </Panel>

        <Panel className="flex flex-col items-center justify-center p-5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">全市场情绪</span>
          <SentimentGauge value={overall.now} size={140} label={overall.now >= 70 ? "贪婪" : "偏多"} />
          <div className="mt-2 text-center text-2xs text-ink-low">
            较 24h <span className="text-bull">+{overall.now - overall["24h"]}</span> · 较 7d <span className="text-bull">+{overall.now - overall["7d"]}</span>
          </div>
        </Panel>
      </div>

      {/* top 10 events */}
      <Panel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <div className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">今日十大事件</h2>
          </div>
          <span className="text-2xs text-ink-low">按 AI 重要性评分排序</span>
        </div>
        <div className="divide-y divide-line">
          {top10.map((e, i) => (
            <Link key={e.id} href={`/events/${e.id}`} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-bg-hover">
              <span className="w-6 text-center font-mono text-sm font-bold text-ink-faint tnum">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{e.title}</div>
                <div className="mt-0.5 flex items-center gap-2">
                  <ImportanceBadge importance={e.importance} />
                  <DirectionBadge direction={e.direction} size="xs" />
                  <span className="text-2xs text-ink-faint">{e.sectors.join(" · ")}</span>
                </div>
              </div>
              <div className="hidden items-center gap-1 sm:flex">
                {e.assets.map((a) => <span key={a} className="chip-signal text-[10px]">{a}</span>)}
              </div>
              <Sparkline data={e.spark} width={56} height={24} color={e.outcome["24h"] >= 0 ? "#2EE6A6" : "#FF5C7A"} />
              <div className="w-20 text-right">
                <div className="text-2xs text-ink-low">24h</div>
                <span className={cn("font-mono text-sm font-semibold tnum", e.outcome["24h"] >= 0 ? "text-bull" : "text-bear")}>
                  {e.outcome["24h"] >= 0 ? "+" : ""}{e.outcome["24h"].toFixed(1)}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* hot projects */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <TrendingUp className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">热门项目</h2>
          </div>
          <div className="divide-y divide-line">
            {hotProjects.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-4 text-center font-mono text-2xs text-ink-faint tnum">{i + 1}</span>
                <span className="chip-signal">{p.symbol}</span>
                <span className="flex-1 truncate text-sm text-ink-mid">{p.name}</span>
                <span className="text-2xs text-ink-low">热度 {p.heat}</span>
                <Delta value={p.change24h} className="text-xs" />
              </div>
            ))}
          </div>
        </Panel>

        {/* hot kols */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Trophy className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">热门 KOL</h2>
          </div>
          <div className="divide-y divide-line">
            {topKols.map((k, i) => (
              <Link key={k.id} href={`/kols/${k.id}`} className="group flex items-center gap-3 px-5 py-2.5 transition-colors hover:bg-bg-hover">
                <span className="w-4 text-center font-mono text-2xs text-ink-faint tnum">{i + 1}</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-bg-elevated font-display text-2xs font-bold text-signal">{k.avatar}</div>
                <span className="flex-1 truncate text-sm font-medium text-ink-high group-hover:text-signal">{k.name}</span>
                <span className="text-2xs text-ink-low">命中率</span>
                <span className="font-mono text-sm font-semibold text-signal tnum">{k.hitRate}%</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      {/* hot sectors */}
      <Panel className="p-5">
        <SectionHeader icon={<Flame className="h-4 w-4" />} title="热点板块" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {sentiments.slice(1, 9).map((s) => {
            const color = s.now >= 70 ? "#2EE6A6" : s.now >= 50 ? "#FFB020" : "#FF5C7A";
            const c = SECTOR_COLORS[s.sector] ?? color;
            return (
              <div key={s.sector} className="rounded-lg border border-line bg-bg-base/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: c }}>{s.label}</span>
                  <span className="font-mono text-xs tnum" style={{ color }}>{s.now}</span>
                </div>
                <Sparkline data={s.trend} width={120} height={24} color={c} className="mt-1.5" />
                <div className="mt-1 text-2xs text-ink-low">24h {s["24h"]} · 7d {s["7d"]}</div>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* risk */}
      <Panel className="relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-bear/10 blur-[70px]" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-bear" />
            <h2 className="font-display text-base font-semibold text-ink-high">风险提示</h2>
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-mid">
            <li className="flex gap-2"><span className="text-bear">•</span> BTC 衍生品杠杆快速上升，前高附近首次冲击常伴随 -4%~-6% 回撤。</li>
            <li className="flex gap-2"><span className="text-bear">•</span> 稳定币连续净流出，购买力减弱，Meme 板块或继续承压。</li>
            <li className="flex gap-2"><span className="text-bear">•</span> HYPE 等热度驱动行情 FOMO 后常现 -20% 回撤，需警惕资金费率拐点。</li>
            <li className="flex gap-2"><span className="text-bear">•</span> ETF 资金属短线资金，持续性弱于长期持有者，流入中断可能引发回撤。</li>
          </ul>
          <div className="mt-4 rounded-lg border border-line bg-bg-base/40 p-3 text-2xs text-ink-low">
            本日报由 AI 自动生成，仅供研究与信息聚合，不构成投资建议。数据可能存在延迟或解读偏差。
          </div>
        </div>
      </Panel>
    </div>
  );
}
