"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

function series(seed: number, len: number, base: number, vol: number) {
  const out: number[] = [];
  let v = base;
  let s = seed;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v = v + (r - 0.5) * vol;
    v = Math.max(35, Math.min(90, v));
    out.push(Number(v.toFixed(1)));
  }
  out[out.length - 1] = base;
  return out;
}

export default function AccuracyChart({ hitRate }: { hitRate: number }) {
  const data = series(hitRate * 7 + 13, 30, hitRate, 6);
  const option: EChartsOption = {
    grid: { left: 4, right: 4, top: 12, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "axis",
      formatter: (p: any) => `<div>命中率 ${p[0].value}%</div>`,
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.map((_, i) => `${i + 1}`),
      axisLine: { lineStyle: { color: "#1A2332" } },
      axisTick: { show: false },
      axisLabel: { color: "#5C6A80", fontSize: 9, interval: 9 },
    },
    yAxis: {
      type: "value",
      min: 30,
      max: 90,
      axisLabel: { color: "#5C6A80", fontSize: 9, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "none",
        data,
        lineStyle: { color: "#16E6C8", width: 2 },
        areaStyle: {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(22,230,200,0.3)" },
              { offset: 1, color: "rgba(22,230,200,0)" },
            ],
          },
        },
        markLine: {
          symbol: "none",
          lineStyle: { color: "rgba(255,176,32,0.4)", type: "dashed" },
          data: [{ yAxis: 50, label: { formatter: "50%", color: "#FFB020", fontSize: 9 } }],
        },
      },
    ],
  };

  return <EChart option={option} height={140} />;
}
