// ============================================================
// 确定性 PRNG + 数据生成辅助
// 用于 Mock Provider 生成可复现、但随时间演化的行情。
// ============================================================
import type { Candle } from "@/types";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number, mean = 0, std = 1) {
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 生成一根根 K 线，模拟趋势+噪声的随机游走
export function generateCandles(opts: {
  seed: number;
  count: number;
  startPrice: number;
  drift: number; // 每根基准漂移
  volatility: number; // 每根波动幅度（比例）
  timeframeSeconds: number;
  endTime?: number;
}) {
  const { seed, count, startPrice, drift, volatility, timeframeSeconds, endTime } = opts;
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  let price = startPrice;
  const end = endTime ?? Math.floor(Date.now() / 1000);
  const start = end - count * timeframeSeconds;

  for (let i = 0; i < count; i++) {
    const open = price;
    const ret =
      drift * timeframeSeconds / 86400 +
      gaussian(rand, 0, volatility * Math.sqrt(timeframeSeconds / 86400));
    let close = open * (1 + ret);
    const high = Math.max(open, close) * (1 + Math.abs(gaussian(rand, 0, volatility * 0.6)));
    const low = Math.min(open, close) * (1 - Math.abs(gaussian(rand, 0, volatility * 0.6)));
    const volume = (0.4 + rand() * 1.2) * (1 + Math.abs(ret) * 40) * 1000;
    candles.push({
      time: start + i * timeframeSeconds,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume: Math.round(volume),
    });
    price = close;
  }
  return candles;
}

export function round(n: number, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// 最近 N 根 K 线计算简单移动平均
export function sma(candles: Candle[], period: number) {
  const out: { time: number; value: number }[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: round(sum / period) });
    }
  }
  return out;
}