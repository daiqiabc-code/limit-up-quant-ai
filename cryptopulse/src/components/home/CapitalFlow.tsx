"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Waves, ArrowDownToLine, ArrowUpFromLine, Fish, Banknote } from "lucide-react";
import { flows } from "@/lib/data";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn, fmtUsd } from "@/lib/utils";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

function spark(seed: number, len = 24, base = 100, vol = 0.03) {
  const out: number[] = [];
  let v = base;
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v = v * (1 + (r - 0.5) * vol * 2 + 0.001);
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

export function CapitalFlow() {
  const netOption: EChartsOption = {
    grid: { left: 8, right: 8, top: 24, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: any) => {
        const p = params[0];
        const v = p.value as number;
        return `<div style="font-weight:600">${p.name}</div>
          <div style="color:${v >= 0 ? "#2EE6A6" : "#FF5C7A"}">净流入 ${v >= 0 ? "+" : "-"}$${Math.abs(v / 1e6).toFixed(0)}M</div>`;
      },
    },
    xAxis: {
      type: "category",
      data: flows.map((f) => f.asset),
      axisLine: { lineStyle: { color: "#1A2332" } },
      axisTick: { show: false },
      axisLabel: { color: "#9AA7BC", fontSize: 11, fontFamily: "var(--font-mono), monospace" },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#5C6A80",
        fontSize: 10,
        formatter: (v: number) => `${v / 1e9 >= 0 ? "" : "-"}$${Math.abs(v / 1e9).toFixed(1)}B`,
      },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
    },
    series: [
      {
        type: "bar",
        barWidth: "46%",
        data: flows.map((f) => ({
          value: f.netFlow,
          itemStyle: {
            color: f.netFlow >= 0 ? "#2EE6A6" : "#FF5C7A",
            borderRadius: [4, 4, 0, 0],
          },
        })),
        label: {
          show: true,
          position: "top",
          color: "#9AA7BC",
          fontSize: 10,
          fontFamily: "var(--font-mono), monospace",
          formatter: (p: any) => `${(p.value as number) / 1e9 >= 0 ? "+" : ""}${((p.value as number) / 1e9).toFixed(2)}B`,
        },
      },
    ],
  };

  return (
    <section id="flows" className="scroll-mt-24">
      <SectionHeader
        index="07"
        icon={<Waves className="h-4 w-4" />}
        title="资金流与链上数据"
        subtitle="交易所净流出入 · 鲸鱼建仓 · 稳定币供给 · 链上异动"
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* Net flow chart */}
        <Panel className="p-4">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink-high">交易所净流入（24h）</h3>
              <p className="text-2xs text-ink-low">正值=净流入交易所（潜在抛压）· 负值=净流出（囤币）</p>
            </div>
            <span className="chip-signal">实时</span>
          </div>
          <EChart option={netOption} height={220} />

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {flows.slice(0, 3).map((f) => (
              <div key={f.asset} className="rounded-lg border border-line bg-bg-base/40 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs font-semibold text-ink-high">{f.asset}</span>
                  <span className={cn("text-2xs tnum", f.netFlow >= 0 ? "text-bull" : "text-bear")}>
                    {f.netFlow >= 0 ? "+" : "-"}${Math.abs(f.netFlow / 1e6).toFixed(0)}M
                  </span>
                </div>
                <Sparkline data={spark(f.asset.length * 17, 20, 100, 0.04)} width={140} height={24} color={f.netFlow >= 0 ? "#2EE6A6" : "#FF5C7A"} className="mt-1" />
              </div>
            ))}
          </div>
        </Panel>

        {/* Right column: stats */}
        <div className="grid gap-3">
          <FlowStat
            icon={<ArrowDownToLine className="h-4 w-4" />}
            label="交易所流入（24h）"
            value="$1.67B"
            color="#FF5C7A"
            spark={spark(71, 24, 100, 0.05)}
            trend="+8.2%"
            trendUp
          />
          <FlowStat
            icon={<ArrowUpFromLine className="h-4 w-4" />}
            label="交易所流出（24h）"
            value="$4.94B"
            color="#2EE6A6"
            spark={spark(72, 24, 100, 0.05)}
            trend="+14.6%"
            trendUp
          />
          <FlowStat
            icon={<Fish className="h-4 w-4" />}
            label="鲸鱼净建仓（7d）"
            value="$1.17B"
            color="#16E6C8"
            spark={spark(73, 24, 100, 0.04)}
            trend="+22.1%"
            trendUp
          />
          <FlowStat
            icon={<Banknote className="h-4 w-4" />}
            label="稳定币总供给"
            value="$142.3B"
            color="#5B9DFF"
            spark={spark(74, 24, 100, 0.015)}
            trend="-0.3%"
          />
        </div>
      </div>

      {/* On-chain heatmap row */}
      <Panel className="mt-4 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold text-ink-high">链上活动热力（7日 × 主流资产）</h3>
          <span className="text-2xs text-ink-low">活跃度归一化 0–100</span>
        </div>
        <OnchainHeatmap />
      </Panel>
    </section>
  );
}

function FlowStat({
  icon,
  label,
  value,
  color,
  spark,
  trend,
  trendUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  spark: number[];
  trend: string;
  trendUp?: boolean;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3 }}>
      <Panel hover className="flex items-center gap-3 p-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `${color}40`, background: `${color}10`, color }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-2xs text-ink-low">{label}</div>
          <div className="font-mono text-lg font-bold text-ink-high tnum">{value}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Sparkline data={spark} width={70} height={26} color={color} />
          <span className={cn("text-2xs tnum", trendUp ? "text-bull" : "text-bear")}>{trend}</span>
        </div>
      </Panel>
    </motion.div>
  );
}

const HEAT_ASSETS = ["BTC", "ETH", "SOL", "HYPE", "ONDO", "LINK", "AAVE"];
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function OnchainHeatmap() {
  // deterministic values
  const cell = (a: number, d: number) => {
    const v = ((a * 13 + d * 7) % 100) + 20;
    return Math.min(100, v);
  };
  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center text-2xs text-ink-faint">{d}</div>
          ))}
          {HEAT_ASSETS.map((a, ai) => (
            <FragmentRow key={a} asset={a} ai={ai} cell={cell} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FragmentRow({ asset, ai, cell }: { asset: string; ai: number; cell: (a: number, d: number) => number }) {
  return (
    <>
      <div className="flex items-center font-mono text-2xs font-semibold text-ink-mid">{asset}</div>
      {DAYS.map((_, d) => {
        const v = cell(ai, d);
        const c = v >= 80 ? "#16E6C8" : v >= 60 ? "#2EE6A6" : v >= 40 ? "#FFB020" : v >= 25 ? "#FF8A4C" : "#FF5C7A";
        return (
          <div
            key={d}
            className="group relative aspect-[2/1] rounded-md transition-transform hover:scale-[1.04]"
            style={{ background: `${c}${Math.round(v * 2.55).toString(16).padStart(2, "0")}` }}
            title={`${asset} ${DAYS[d]}: ${v}`}
          >
            <span className="absolute inset-0 flex items-center justify-center font-mono text-2xs font-semibold text-black/70 opacity-0 transition-opacity group-hover:opacity-100">
              {v}
            </span>
          </div>
        );
      })}
    </>
  );
}
