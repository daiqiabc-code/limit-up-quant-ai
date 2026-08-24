"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useTradingStore, getMarketClient } from "@/store/tradingStore";
import { TIMEFRAMES } from "@/services/mock/universe";
import { LoadingState, ErrorState } from "@/components/ui/State";
import { sma } from "@/services/mock/rand";

export function BtcChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const maSeries = useRef<{ period: number; series: ISeriesApi<"Line"> }[]>([]);

  const symbol = useTradingStore((s) => s.selectedSymbol);
  const timeframe = useTradingStore((s) => s.timeframe);
  const dataProvider = useTradingStore((s) => s.settings.dataProvider);
  const setTimeframe = useTradingStore((s) => s.setTimeframe);
  const [data, setData] = useState<{ ok: boolean; msg?: string }>({ ok: false });

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#111827" },
        textColor: "#94A3B8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1F2937" },
        horzLines: { color: "#1F2937" },
      },
      rightPriceScale: { borderColor: "#1F2937" },
      timeScale: { borderColor: "#1F2937", timeVisible: true },
      width: containerRef.current.clientWidth,
      height: 420,
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#22C55E",
      downColor: "#EF4444",
      borderUpColor: "#22C55E",
      borderDownColor: "#EF4444",
      wickUpColor: "#22C55E",
      wickDownColor: "#EF4444",
    });

    const volume = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    chartRef.current = chart;
    candleSeries.current = candles;
    volumeSeries.current = volume;

    const onResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      maSeries.current = [];
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const candles = await getMarketClient().getCandles(symbol, timeframe, 300);
        if (cancelled || !candleSeries.current) return;
        const cs = candles.map<CandlestickData>((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeries.current.setData(cs);

        const vol = candles.map<HistogramData>((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)",
        }));
        volumeSeries.current?.setData(vol);

        // 清理旧均线
        for (const m of maSeries.current) chartRef.current?.removeSeries(m.series);
        maSeries.current = [];
        const maColors: Record<number, string> = { 20: "#3B82F6", 50: "#F59E0B", 80: "#A855F7" };
        const chart = chartRef.current;
        if (chart) {
          for (const period of [20, 50, 80]) {
            const series = chart.addLineSeries({
              color: maColors[period],
              lineWidth: 1,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            const points = sma(candles, period).map<LineData>((x) => ({ time: x.time as UTCTimestamp, value: x.value }));
            series.setData(points);
            maSeries.current.push({ period, series });
          }
        }
        chartRef.current?.timeScale().fitContent();
        setData({ ok: true });
      } catch (e) {
        if (!cancelled) setData({ ok: false, msg: e instanceof Error ? e.message : "图表加载失败" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe, dataProvider]);

  return (
    <div className="rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-text">{symbol}</span>
          <div className="flex items-center gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={
                  "rounded-md px-2 py-1 text-[11px] font-medium transition-colors " +
                  (timeframe === tf ? "bg-white/10 text-text" : "text-muted hover:bg-white/5 hover:text-text")
                }
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-info" />MA20</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-warn" />MA50</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-purple-500" />MA80</span>
        </div>
      </div>
      {data.ok === false && data.msg ? (
        <ErrorState message={data.msg} />
      ) : (
      <div className="relative p-2">
        <div ref={containerRef} className="h-[420px] w-full" />
      </div>
      )}
    </div>
  );
}