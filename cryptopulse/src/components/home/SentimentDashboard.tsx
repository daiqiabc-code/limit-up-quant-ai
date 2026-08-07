"use client";

import { motion } from "framer-motion";
import { Activity, Thermometer, ArrowUp, ArrowDown } from "lucide-react";
import { sentiments } from "@/lib/data";
import type { Sentiment } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { SentimentGauge } from "@/components/ui/Gauge";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils";

function mood(v: number) {
  return v >= 75 ? "贪婪" : v >= 55 ? "偏多" : v >= 45 ? "中性" : v >= 30 ? "谨慎" : "恐惧";
}
function moodColor(v: number) {
  return v >= 70 ? "#2EE6A6" : v >= 50 ? "#FFB020" : v >= 35 ? "#FF8A4C" : "#FF5C7A";
}

export function SentimentDashboard() {
  const overall = sentiments[0];
  const sectors = sentiments.slice(1);

  return (
    <section id="sentiment" className="scroll-mt-24">
      <SectionHeader
        index="03"
        icon={<Thermometer className="h-4 w-4" />}
        title="市场情绪仪表盘"
        subtitle="0–100 情绪指数 · 覆盖主流板块与叙事 · 24h / 7d / 30d 趋势"
        action={
          <div className="flex items-center gap-1.5">
            <span className="chip"><Activity className="h-3 w-3 text-signal" /> 实时</span>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Overall */}
        <Panel className="relative overflow-hidden p-5">
          <div className="pointer-events-none absolute inset-0 bg-radial-fade" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">全市场情绪</span>
              <span className="chip-signal">{mood(overall.now)}</span>
            </div>
            <div className="mt-2 flex justify-center">
              <SentimentGauge value={overall.now} size={180} label={mood(overall.now)} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <PeriodCell label="24h" now={overall.now} prev={overall["24h"]} />
              <PeriodCell label="7d" now={overall.now} prev={overall["7d"]} />
              <PeriodCell label="30d" now={overall.now} prev={overall["30d"]} />
            </div>
            <div className="mt-3 rounded-lg border border-line bg-bg-base/50 p-2.5">
              <div className="mb-1 text-2xs uppercase tracking-wider text-ink-low">30 日趋势</div>
              <Sparkline data={overall.trend} width={260} height={48} color="#16E6C8" />
            </div>
          </div>
        </Panel>

        {/* Sector grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sectors.map((s, i) => (
            <SectorCard key={s.sector} s={s} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PeriodCell({ label, now, prev }: { label: string; now: number; prev: number }) {
  const diff = now - prev;
  const up = diff >= 0;
  return (
    <div className="rounded-lg border border-line bg-bg-base/40 p-2 text-center">
      <div className="text-2xs text-ink-low">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-semibold text-ink-high tnum">{now}</div>
      <div className={cn("mt-0.5 flex items-center justify-center gap-0.5 text-2xs tnum", up ? "text-bull" : "text-bear")}>
        {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
        {Math.abs(diff).toFixed(0)}
      </div>
    </div>
  );
}

function SectorCard({ s, index }: { s: Sentiment; index: number }) {
  const color = moodColor(s.now);
  const diff24 = s.now - s["24h"];
  const up = diff24 >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: index * 0.03 }}
    >
      <Panel hover className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold text-ink-high">{s.label}</span>
            <span className="text-2xs text-ink-faint">{s.sector}</span>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-2xs font-semibold"
            style={{ color, background: `${color}14`, border: `1px solid ${color}30` }}
          >
            {mood(s.now)}
          </span>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="font-mono text-3xl font-bold tnum" style={{ color }}>
              {s.now}
            </div>
            <div className={cn("mt-0.5 flex items-center gap-0.5 text-2xs tnum", up ? "text-bull" : "text-bear")}>
              {up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {Math.abs(diff24).toFixed(0)} vs 24h
            </div>
          </div>
          <Sparkline data={s.trend} width={96} height={40} color={color} />
        </div>

        {/* period bar */}
        <div className="mt-3 flex h-1.5 gap-1">
          {([["24h", s["24h"]], ["7d", s["7d"]], ["30d", s["30d"]]] as const).map(([l, v]) => (
            <div key={l} className="flex-1">
              <div className="h-full w-full overflow-hidden rounded-full bg-bg-elevated">
                <div className="h-full rounded-full" style={{ width: `${v}%`, background: moodColor(v) }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-2xs text-ink-faint">
          <span>24h {s["24h"]}</span>
          <span>7d {s["7d"]}</span>
          <span>30d {s["30d"]}</span>
        </div>
      </Panel>
    </motion.div>
  );
}
