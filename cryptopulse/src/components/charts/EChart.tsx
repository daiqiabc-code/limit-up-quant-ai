"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { useTheme } from "./EChartTheme";

export interface EChartProps {
  option: echarts.EChartsCoreOption;
  height?: number | string;
  className?: string;
  onEvents?: Record<string, (params: any) => void>;
}

export default function EChart({ option, height = 240, className, onEvents }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!ref.current) return;
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: "canvas" });
    }
    chartRef.current.setOption({ ...theme, ...option } as any, { notMerge: true });
    if (onEvents) {
      Object.entries(onEvents).forEach(([k, fn]) => {
        chartRef.current?.on(k, fn as any);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  useEffect(() => {
    const handle = () => chartRef.current?.resize();
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("resize", handle);
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ width: "100%", height: typeof height === "number" ? `${height}px` : height }}
    />
  );
}
