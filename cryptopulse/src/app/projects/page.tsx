"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Grid3x3 } from "lucide-react";
import { projects } from "@/lib/data";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { Delta } from "@/components/ui/Badges";
import { SECTOR_COLORS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

const SECTORS = ["全部", "BTC", "ETH", "SOL", "DeFi", "RWA", "Meme"];

export default function ProjectsPage() {
  const [sector, setSector] = useState("全部");
  const sorted = [...projects].sort((a, b) => b.heat - a.heat);
  const filtered = sector === "全部" ? sorted : sorted.filter((p) => p.sector === sector);

  const option: EChartsOption = {
    tooltip: {
      formatter: (p: any) => `<div style="font-weight:600">${p.data.symbol}</div>
        <div style="color:#9AA7BC">热度 ${p.data.heatValue} (${p.data.heatChange > 0 ? "+" : ""}${p.data.heatChange}%)</div>
        <div style="color:${p.data.change >= 0 ? "#2EE6A6" : "#FF5C7A"}">24h ${p.data.change >= 0 ? "+" : ""}${p.data.change}%</div>`,
    },
    series: [{
      type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false },
      width: "100%", height: "100%",
      label: {
        show: true,
        formatter: (p: any) => `{a|${p.data.symbol}}\n{b|热度 ${p.data.heatValue}}`,
        rich: {
          a: { color: "#fff", fontSize: 14, fontWeight: 700, lineHeight: 18, fontFamily: "var(--font-mono), monospace" },
          b: { color: "rgba(255,255,255,0.7)", fontSize: 10, lineHeight: 14, fontFamily: "var(--font-mono), monospace" },
        },
      },
      itemStyle: { borderColor: "#06080C", borderWidth: 3, gapWidth: 3, borderRadius: 6 },
      data: filtered.map((p) => {
        const c = p.change24h;
        const color = c >= 8 ? "#16E6C8" : c >= 3 ? "#2EE6A6" : c >= 0 ? "#3a5a52" : c >= -3 ? "#5a3a4a" : c >= -6 ? "#FF8A4C" : "#FF5C7A";
        return { name: p.symbol, symbol: p.symbol, value: p.heat, heatValue: p.heat, heatChange: p.heatChange, change: p.change24h, itemStyle: { color } };
      }),
    }],
  };

  return (
    <div className="space-y-5">
      <SectionHeader index="" icon={<Grid3x3 className="h-4 w-4" />} title="项目数据库" subtitle="热度量化 · 24h 涨跌 · KOL 讨论度" />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Panel className="p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">热度 TreeMap</span>
            <div className="flex items-center gap-2 text-2xs text-ink-low">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-bear" />跌</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-bull" />涨</span>
            </div>
          </div>
          <EChart option={option} height={320} />
        </Panel>

        <Panel className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">热度榜</span>
            <div className="flex flex-wrap gap-1">
              {SECTORS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSector(s)}
                  className={cn("rounded-full border px-2 py-0.5 text-2xs transition-all", sector === s ? "border-signal/50 bg-signal/10 text-signal" : "border-line text-ink-low hover:text-ink-mid")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line">
            {filtered.map((p, i) => (
              <Link key={p.id} href={`/search?q=${p.symbol}`} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-bg-hover">
                <span className="w-4 text-center font-mono text-2xs text-ink-faint tnum">{i + 1}</span>
                <span className="flex h-7 w-7 items-center justify-center rounded-md border font-mono text-2xs font-bold" style={{ borderColor: `${SECTOR_COLORS[p.sector]}40`, color: SECTOR_COLORS[p.sector], background: `${SECTOR_COLORS[p.sector]}10` }}>{p.symbol.slice(0, 3)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-ink-high group-hover:text-signal">{p.symbol}</span>
                    <span className="truncate text-2xs text-ink-low">{p.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-low">
                    <span className="chip text-[9px]" style={{ borderColor: `${SECTOR_COLORS[p.sector]}40`, color: SECTOR_COLORS[p.sector] }}>{p.sector}</span>
                    <span>{p.kolMentions} KOL · {p.mentions} 提及</span>
                  </div>
                </div>
                <Sparkline data={p.spark} width={50} height={22} color={p.change24h >= 0 ? "#2EE6A6" : "#FF5C7A"} />
                <div className="w-16 text-right">
                  <div className="font-mono text-sm font-semibold text-ink-high tnum">{p.heat}</div>
                  <Delta value={p.change24h} className="text-2xs" />
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
