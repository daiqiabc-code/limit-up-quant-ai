"use client";

import type { EChartsOption } from "echarts";

const COLORS = {
  ink: "#E8EEF6",
  inkMid: "#9AA7BC",
  inkLow: "#5C6A80",
  line: "#1A2332",
  panel: "#0C1119",
  signal: "#16E6C8",
  bull: "#2EE6A6",
  bear: "#FF5C7A",
  warn: "#FFB020",
  info: "#5B9DFF",
  violet: "#A78BFA",
};

export const PALETTE = [
  COLORS.signal,
  COLORS.info,
  COLORS.violet,
  COLORS.warn,
  COLORS.bull,
  COLORS.bear,
];

export function useTheme(): EChartsOption {
  return {
    color: PALETTE,
    backgroundColor: "transparent",
    textStyle: {
      color: COLORS.inkMid,
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      fontSize: 11,
    },
    title: { textStyle: { color: COLORS.ink } },
    legend: {
      textStyle: { color: COLORS.inkMid, fontSize: 11 },
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
    },
    tooltip: {
      backgroundColor: "rgba(8,11,17,0.96)",
      borderColor: COLORS.line,
      borderWidth: 1,
      borderRadius: 8,
      padding: [8, 10],
      textStyle: { color: COLORS.ink, fontSize: 12, fontFamily: "var(--font-mono), monospace" },
      extraCssText: "backdrop-filter: blur(8px); box-shadow: 0 12px 32px -8px rgba(0,0,0,0.6);",
    },
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      axisLine: { lineStyle: { color: COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: COLORS.inkLow, fontSize: 10, fontFamily: "var(--font-mono), monospace" },
      splitLine: { show: false },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: COLORS.inkLow, fontSize: 10, fontFamily: "var(--font-mono), monospace" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: COLORS.line } },
      axisTick: { show: false },
      axisLabel: { color: COLORS.inkLow, fontSize: 10 },
      splitLine: { show: false },
    },
  };
}

export { COLORS };
