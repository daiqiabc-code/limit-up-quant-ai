"use client";

import { motion } from "framer-motion";
import { Sparkles, ShieldCheck, Radar, Crosshair, ChevronRight } from "lucide-react";
import Link from "next/link";
import { assets, alphaSignals } from "@/lib/data";
import { Sparkline } from "@/components/ui/Sparkline";
import { Delta } from "@/components/ui/Badges";
import { fmtTime } from "@/lib/utils";

const PROMISES = [
  { icon: Radar, title: "今天最重要事件", desc: "AI 聚类 + 重要性评分" },
  { icon: ShieldCheck, title: "哪些信息最可信", desc: "KOL Trust Score 验证" },
  { icon: Crosshair, title: "哪些信号值得研究", desc: "Alpha Signals 持续追踪" },
];

export function Hero() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  const top = assets.slice(0, 4);

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid-faint [background-size:28px_28px] opacity-40" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[80%] -translate-x-1/2 rounded-full bg-signal/10 blur-[120px]" />

      <div className="relative grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Left: headline */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2">
            <span className="chip-signal">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />
              AI Crypto Intelligence Terminal
            </span>
            <span className="chip font-mono tnum">{dateStr}</span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-high sm:text-5xl lg:text-6xl">
            过去 24 小时
            <br />
            <span className="text-gradient-signal glow-text-signal">最值得关注的</span>
            <br />
            中文 Crypto 情报
          </h1>

          <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-mid">
            不是新闻聚合，也不是 Twitter 搬运。AI 自动筛选、聚类、分析、验证并持续追踪海量中文 Crypto 推文，
            把噪音转化为真正有价值的情报。
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {PROMISES.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-bg-panel/60 p-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
                  <p.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-high">{p.title}</div>
                  <div className="truncate text-2xs text-ink-low">{p.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            <Link href="#signals" className="btn-primary h-9">
              <Sparkles className="h-4 w-4" /> 进入情报看板 <ChevronRight className="h-4 w-4" />
            </Link>
            <Link href="/daily" className="btn h-9">今日 AI 日报</Link>
          </div>
        </motion.div>

        {/* Right: live market snapshot */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="panel relative overflow-hidden p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">实时市场快照</span>
            <span className="font-mono text-2xs text-ink-low tnum">{fmtTime(Date.now())}</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {top.map((a) => (
              <div key={a.symbol} className="rounded-lg border border-line bg-bg-base/40 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-ink-high">{a.symbol}</span>
                  <Delta value={a.change24h} className="text-2xs" />
                </div>
                <div className="mt-0.5 font-mono text-base font-semibold text-ink-high tnum">
                  ${a.price >= 1000 ? a.price.toLocaleString("en-US", { maximumFractionDigits: 0 }) : a.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </div>
                <Sparkline data={a.spark} width={120} height={28} color={a.change24h >= 0 ? "#2EE6A6" : "#FF5C7A"} className="mt-1" />
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-signal/20 bg-signal/[0.04] p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-signal">
                <Sparkles className="h-3 w-3" /> AI 信号摘要
              </span>
              <span className="text-2xs text-ink-low">{alphaSignals.length} 条活跃</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-mid">
              高可信 KOL 共振看多 <span className="font-semibold text-signal">ETH</span>；BTC 链上资金持续流入；
              <span className="font-semibold text-bull">HYPE</span> 热度暴涨 312%；Meme 板块资金撤离。
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
