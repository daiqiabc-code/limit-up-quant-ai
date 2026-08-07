"use client";

import dynamic from "next/dynamic";
import { propagationLinks, propagationNodes } from "@/lib/data";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

const GROUP_STYLE: Record<string, { color: string; label: string }> = {
  origin: { color: "#FFB020", label: "首发" },
  amplifier: { color: "#16E6C8", label: "放大" },
  spread: { color: "#5B9DFF", label: "传播" },
  global: { color: "#A78BFA", label: "破圈" },
};

export function PropagationGraph({ height = 320 }: { height?: number }) {
  const option: EChartsOption = {
    tooltip: {
      formatter: (p: any) => {
        if (p.dataType === "node") {
          const g = GROUP_STYLE[p.data.group];
          return `<div style="font-weight:600">${p.data.text}</div>
            <div style="color:#9AA7BC">角色：${g.label}</div>
            <div style="color:#9AA7BC">语言：${p.data.lang === "zh" ? "中文圈" : "英文圈"}</div>
            <div style="color:#9AA7BC">影响力 ${p.data.value}</div>`;
        }
        return "";
      },
    },
    legend: {
      data: Object.values(GROUP_STYLE).map((g) => g.label),
      textStyle: { color: "#9AA7BC", fontSize: 11 },
      icon: "circle",
      bottom: 0,
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        symbolSize: (val: number) => Math.sqrt(val) * 6,
        label: { show: true, color: "#E8EEF6", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-body)" },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 7],
        force: { repulsion: 240, edgeLength: [60, 140], gravity: 0.08 },
        lineStyle: { color: "rgba(148,163,184,0.25)", width: 1.2, curveness: 0.18 },
        emphasis: {
          lineStyle: { color: "#16E6C8", width: 2 },
          label: { color: "#16E6C8" },
        },
        categories: Object.entries(GROUP_STYLE).map(([k, v]) => ({ name: v.label })),
        data: propagationNodes.map((n) => ({
          id: n.id,
          name: n.label,
          text: n.label,
          value: n.value,
          group: n.group,
          lang: n.lang,
          category: GROUP_STYLE[n.group].label,
          itemStyle: { color: GROUP_STYLE[n.group].color, borderColor: `${GROUP_STYLE[n.group].color}`, borderWidth: 1.5, shadowBlur: 12, shadowColor: `${GROUP_STYLE[n.group].color}66` },
        })),
        links: propagationLinks.map((l) => ({ source: l.source, target: l.target, value: l.value })),
      },
    ],
  };

  return <EChart option={option} height={height} />;
}
