"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Grid3x3, ArrowUpRight, Flame } from "lucide-react";
import dynamic from "next/dynamic";
import { projects } from "@/lib/data";
import { SECTOR_COLORS } from "@/lib/labels";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { Delta } from "@/components/ui/Badges";
import { cn } from "@/lib/utils";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

export function ProjectTreemap() {
  const sorted = [...projects].sort((a, b) => b.heat - a.heat);
  const top = sorted.slice(0, 6);

  const option: EChartsOption = {
    tooltip: {
      formatter: (p: any) => {
        const d = p.data;
        return `<div style="font-weight:600;margin-bottom:2px">${d.symbol} · ${d.name}</div>
          <div style="color:#9AA7BC">热度 ${d.heatValue} (${d.heatChange > 0 ? "+" : ""}${d.heatChange}%)</div>
          <div style="color:${d.change >= 0 ? "#2EE6A6" : "#FF5C7A"}">24h ${d.change >= 0 ? "+" : ""}${d.change}%</div>`;
      },
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        label: {
          show: true,
          formatter: (p: any) => `{a|${p.data.symbol}}\n{b|${p.data.heatValue}}`,
          rich: {
            a: { color: "#fff", fontSize: 13, fontWeight: 700, lineHeight: 18, fontFamily: "var(--font-mono), monospace" },
            b: { color: "rgba(255,255,255,0.7)", fontSize: 11, lineHeight: 14, fontFamily: "var(--font-mono), monospace" },
          },
        },
        itemStyle: { borderColor: "#06080C", borderWidth: 3, gapWidth: 3, borderRadius: 6 },
        data: sorted.map((p) => {
          const c = p.change24h;
          const color =
            c >= 8 ? "#16E6C8" : c >= 3 ? "#2EE6A6" : c >= 0 ? "#3a5a52" : c >= -3 ? "#5a3a4a" : c >= -6 ? "#FF8A4C" : "#FF5C7A";
          return {
            name: p.symbol,
            symbol: p.symbol,
            value: p.heat,
            heatValue: p.heat,
            heatChange: p.heatChange,
            change: p.change24h,
            name2: p.name,
            itemStyle: { color },
          };
        }),
      },
    ],
  };

  return (
    <section id="projects" className="scroll-mt-24">
      <SectionHeader
        index="05"
        icon={<Grid3x3 className="h-4 w-4" />}
        title="热门项目排行"
        subtitle="TreeMap 按热度量化 · 颜色映射 24h 涨跌 · 钻取至项目分析"
        action={
          <Link href="/projects" className="btn-ghost h-8 text-xs">
            全部项目 <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Treemap */}
        <Panel className="relative overflow-hidden p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">热度 TreeMap</span>
            <div className="flex items-center gap-2 text-2xs text-ink-low">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-bear" />跌</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-warn/60" />平</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-bull" />涨</span>
            </div>
          </div>
          <EChart option={option} height={300} />
        </Panel>

        {/* List */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">热度榜</span>
            <span className="text-2xs text-ink-low">热度 / 24h</span>
          </div>
          <div className="divide-y divide-line">
            {top.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <Link href={`/search?q=${p.symbol}`} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg-hover">
                  <span className="w-4 text-center font-mono text-2xs text-ink-faint tnum">{i + 1}</span>
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-md border font-mono text-2xs font-bold"
                    style={{ borderColor: `${SECTOR_COLORS[p.sector]}40`, color: SECTOR_COLORS[p.sector], background: `${SECTOR_COLORS[p.sector]}10` }}
                  >
                    {p.symbol.slice(0, 3)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink-high group-hover:text-signal">{p.symbol}</span>
                      <span className="truncate text-2xs text-ink-low">{p.name}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="chip text-[9px]" style={{ borderColor: `${SECTOR_COLORS[p.sector]}40`, color: SECTOR_COLORS[p.sector] }}>{p.sector}</span>
                      <span className={cn("flex items-center gap-0.5 text-2xs tnum", p.heatChange >= 0 ? "text-bull" : "text-bear")}>
                        <Flame className="h-2.5 w-2.5" />
                        {p.heatChange >= 0 ? "+" : ""}{p.heatChange}%
                      </span>
                    </div>
                  </div>
                  <Sparkline data={p.spark} width={48} height={22} color={p.change24h >= 0 ? "#2EE6A6" : "#FF5C7A"} />
                  <div className="w-16 text-right">
                    <div className="font-mono text-sm font-semibold text-ink-high tnum">{p.heat}</div>
                    <Delta value={p.change24h} className="text-2xs" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}
