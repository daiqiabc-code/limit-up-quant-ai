"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

export default function OutcomeChart({
  outcome,
  direction,
}: {
  outcome: { "1h": number; "24h": number; "7d": number; "30d": number; "90d": number };
  direction: "bullish" | "neutral" | "bearish";
}) {
  const periods: ["1h", "24h", "7d", "30d", "90d"] = ["1h", "24h", "7d", "30d", "90d"];
  const color = direction === "bullish" ? "#2EE6A6" : direction === "bearish" ? "#FF5C7A" : "#FFB020";

  const option: EChartsOption = {
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (p: any) => `<div style="font-weight:600">${p[0].name}</div><div style="color:${p[0].value >= 0 ? "#2EE6A6" : "#FF5C7A"}">${p[0].value >= 0 ? "+" : ""}${p[0].value}%</div>`,
    },
    xAxis: {
      type: "category",
      data: periods,
      axisLine: { lineStyle: { color: "#1A2332" } },
      axisTick: { show: false },
      axisLabel: { color: "#9AA7BC", fontSize: 11, fontFamily: "var(--font-mono), monospace" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#5C6A80", fontSize: 10, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
    },
    series: [
      {
        type: "bar",
        barWidth: "44%",
        data: periods.map((p) => ({
          value: outcome[p],
          itemStyle: {
            color: outcome[p] === 0 ? "#1A2332" : outcome[p] >= 0 ? "#2EE6A6" : "#FF5C7A",
            borderRadius: outcome[p] >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
          },
        })),
        markLine: {
          symbol: "none",
          lineStyle: { color: "rgba(148,163,184,0.3)", type: "dashed" },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
    ],
  };

  return <EChart option={option} height={200} />;
}
