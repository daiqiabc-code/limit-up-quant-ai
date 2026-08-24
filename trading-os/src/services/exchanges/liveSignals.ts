// ============================================================
// 实时信号计算引擎
// 基于真实 K 线 + 实时价格重算信号（机会）、市场状态与持仓现价。
// 使机会/价格真正与实时行情联动，而非 Mock 随机值。
// ============================================================
import type {
  Action,
  Asset,
  Candle,
  Direction,
  MarketRegime,
  RegimeState,
  RiskLevel,
  SetupStage,
  SetupType,
  Signal,
  SignalBreakdown,
  TradingSnapshot,
  Trend,
} from "@/types";
import { clamp, round } from "@/services/mock/rand";

type CandleFetcher = (symbol: string, timeframe: string, limit: number) => Promise<Candle[]>;

// K 线为低频数据（4H 每 4 小时才更新一根），做模块级缓存，
// 避免价格每 4 秒轮询时重复拉取全量 K 线、打爆上游 API。
const candleCache = new Map<string, { ts: number; data: Candle[] }>();
const CANDLE_TTL = 60_000;

async function getCandlesCached(symbol: string, timeframe: string, limit: number, fc: CandleFetcher): Promise<Candle[]> {
  const key = `${symbol}-${timeframe}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.ts < CANDLE_TTL) return hit.data;
  const data = await fc(symbol, timeframe, limit);
  if (Array.isArray(data) && data.length > 0) candleCache.set(key, { ts: Date.now(), data });
  return data;
}

// ---------- 基础指标 ----------
function lastMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] ?? 0;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

function averageRangePct(candles: Candle[], period: number): number {
  const start = Math.max(0, candles.length - period);
  const n = candles.length - start;
  if (n <= 0) return 0.03;
  let sum = 0;
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    sum += (c.high - c.low) / (c.close || 1);
  }
  return sum / n;
}

function volumeRatio(candles: Candle[]): number {
  const n = candles.length;
  const recent = candles.slice(n - 8).reduce((s, c) => s + c.volume, 0) / Math.max(1, Math.min(8, n));
  const prior = candles.slice(Math.max(0, n - 24), Math.max(0, n - 8)).reduce((s, c) => s + c.volume, 0) / Math.max(1, Math.min(16, n - 8));
  return prior > 0 ? recent / prior : 1;
}

function pctChange(closes: number[], lookback: number): number {
  const back = closes.length - 1 - lookback;
  const prev = closes[Math.max(0, back)];
  const last = closes[closes.length - 1];
  return prev > 0 ? (last - prev) / prev : 0;
}

// ---------- 信号重算 ----------
export function computeLiveSignal(symbol: string, asset: Asset, candles: Candle[]): Signal {
  const closes = candles.map((c) => c.close);
  const price = asset.price;
  const ma20 = lastMA(closes, 20);
  const ma80 = lastMA(closes, 80);

  const bull = ma20 > ma80 && price > ma80;
  const bear = ma20 < ma80 && price < ma80;
  const trend: Trend = bull ? "BULL" : bear ? "BEAR" : "RANGE";

  const atrPct = averageRangePct(candles, 20);
  const ret8 = pctChange(closes, 8);
  const ret32 = pctChange(closes, 32);
  const vRatio = volumeRatio(candles);

  // 各维度评分（真实数据驱动，满分 20/20/20/15/10/10/5）
  const trendScore = clamp(Math.round((bull ? 18 : bear ? 6 : 12) + ret32 * 60), 0, 20);
  const structureScore = clamp(Math.round((bull ? 15 : bear ? 9 : 12) + (price > ma20 ? 2 : -2)), 0, 20);
  const momentumScore = clamp(Math.round(12 + ret8 * 120), 0, 20);
  const volumeScore = clamp(Math.round(vRatio > 1.2 ? 13 : vRatio > 1 ? 10 : vRatio > 0.7 ? 8 : 5), 0, 15);
  const htfScore = clamp(Math.round((bull || bear) ? 8 : 5), 0, 10);
  const setupScore = clamp(Math.round((bull && price <= ma20 * 1.02 && price >= ma20 * 0.995) ? 8 : bull ? 6 : bear ? 3 : 5), 0, 10);
  const rr = clamp(2 + (ret32 > 0 ? ret32 * 30 : ret32 * 10), 1.2, 4);
  const rrScore = clamp(Math.round(rr >= 3 ? 5 : rr >= 2 ? 4 : 2), 0, 5);

  const breakdown: SignalBreakdown = {
    trend: trendScore,
    structure: structureScore,
    momentum: momentumScore,
    volume: volumeScore,
    htfAlignment: htfScore,
    setup: setupScore,
    riskReward: rrScore,
  };
  const score = clamp(
    breakdown.trend + breakdown.structure + breakdown.momentum + breakdown.volume + breakdown.htfAlignment + breakdown.setup + breakdown.riskReward,
    0, 100,
  );

  // 形态判断
  let setup: SetupType;
  if (trend === "BULL") {
    setup = price <= ma20 * 1.02 && price >= ma20 * 0.995 ? "PULLBACK" : price >= highOf(candles, 20) ? "BREAKOUT" : "RE_ENTRY";
  } else if (trend === "RANGE") {
    setup = "RANGE";
  } else {
    setup = "NONE";
  }

  // 操作建议
  let action: Action;
  if (bear) action = score >= 70 ? "WATCH" : "AVOID";
  else if (bull && score >= 85) action = "LONG";
  else if (score >= 70) action = "WATCH";
  else if (score >= 55) action = "WAIT";
  else action = "AVOID";

  const risk: RiskLevel = score >= 80 ? "LOW" : score >= 60 ? "MEDIUM" : "HIGH";
  const stage: SetupStage =
    score >= 90 ? "ENTRY" : score >= 80 ? "RESTART" : score >= 65 ? (trend === "BULL" ? "PULLBACK" : "WAIT") : setup === "BREAKOUT" ? "BREAKOUT" : "WAIT";

  const riskReward = round(rr, 1);
  const entry = round(price);
  const stop = round(bull ? price * (1 - atrPct * 2) : price * (1 + atrPct * 2));
  const target = round(bull ? price * (1 + atrPct * 2 * rr) : price * (1 - atrPct * 2 * rr));

  return {
    symbol,
    score,
    breakdown,
    trend,
    setup,
    setupStage: stage,
    action,
    entry,
    stop,
    target,
    riskReward,
    risk,
    reason: reasonFor(trend, setup, score, atrPct),
    updatedAt: Date.now(),
  };
}

function highOf(candles: Candle[], period: number): number {
  return Math.max(...candles.slice(-period).map((c) => c.high));
}

function reasonFor(trend: Trend, setup: SetupType, score: number, atrPct: number): string {
  const parts: string[] = [];
  parts.push(trend === "BULL" ? "均线多头排列，价格站上 MA80" : trend === "BEAR" ? "均线空头排列，价格跌破 MA80" : "均线缠绕，处于震荡区间");
  if (setup === "PULLBACK") parts.push("回踩 MA20 关键支撑");
  else if (setup === "BREAKOUT") parts.push("突破近期高点形成突破形态");
  else if (setup === "RE_ENTRY") parts.push("趋势延续，二次入场窗口");
  else if (setup === "RANGE") parts.push("区间上下沿博弈");
  else parts.push("暂无明确结构");
  parts.push(`4H 平均振幅约 ${(atrPct * 100).toFixed(1)}%`);
  parts.push(score >= 85 ? "动量强劲" : score >= 65 ? "动量中性" : "动量偏弱");
  return parts.join(" · ");
}

// ---------- 市场状态重算 ----------
export function computeLiveRegime(symbol: string, asset: Asset, candles: Candle[]): MarketRegime {
  const closes = candles.map((c) => c.close);
  const price = asset.price;
  const ma20 = lastMA(closes, 20);
  const ma80 = lastMA(closes, 80);
  const atrPct = averageRangePct(candles, 20);
  const vRatio = volumeRatio(candles);
  const chg = pctChange(closes, closes.length > 32 ? 32 : 8);

  const bull = ma20 > ma80 && price > ma80;
  const bear = ma20 < ma80 && price < ma80;
  const state: RegimeState = bull ? "BULL_TREND" : bear ? "BEAR_TREND" : "RANGE";

  const shouldUp = chg > 0.001;
  const shouldDown = chg < -0.001;
  const h4: Direction = bull ? "UP" : bear ? "DOWN" : "FLAT";
  const daily: Direction = shouldUp ? (bear ? "FLAT" : "UP") : shouldDown ? (bull ? "FLAT" : "DOWN") : "FLAT";
  const h1: Direction = pctChange(closes, 4) > 0.001 ? "UP" : pctChange(closes, 4) < -0.001 ? "DOWN" : "FLAT";

  const maGap = ma80 > 0 ? (Math.abs(ma20 - ma80) / ma80) * 100 : 0;
  const adx = round(clamp(12 + maGap * 8, 8, 45), 1);

  const volume: MarketRegime["volume"] = vRatio > 1.3 ? "EXPANDING" : vRatio < 0.7 ? "CONTRACTING" : "NORMAL";
  const volatility: MarketRegime["volatility"] =
    atrPct < 0.015 ? "LOW" : atrPct < 0.03 ? "NORMAL" : atrPct < 0.05 ? "HIGH" : "EXTREME";

  return {
    symbol,
    state,
    daily,
    h4,
    h1,
    ma80: price > ma80 ? "ABOVE" : "BELOW",
    adx,
    volume,
    volatility,
    structure: bull ? "高点抬高" : bear ? "低点降低" : "区间震荡",
    updatedAt: Date.now(),
  };
}

// ---------- 持仓现价同步 ----------
// 实时模式下，将持仓锚定到实时价格，避免 Mock 入场价与实时现价脱节
// 产生荒谬的巨额浮盈亏。保留原始收益率意图（unrealizedPnlPct），
// 以实时价反推入场/止损/止盈/爆仓，保证数据自洽。
function syncPositions(snapshot: TradingSnapshot): void {
  snapshot.positions = snapshot.positions.map((p) => {
    const asset = snapshot.assets[p.symbol];
    if (!asset) return p;
    const realPrice = asset.price;
    const pnlPct = p.unrealizedPnlPct; // 保留原始收益/亏损意图
    const lev = p.leverage;
    const entry = p.side === "LONG" ? realPrice / (1 + pnlPct / lev / 100) : realPrice / (1 - pnlPct / lev / 100);
    const stopPct = 0.04;
    const stopLoss = round(p.side === "LONG" ? entry * (1 - stopPct) : entry * (1 + stopPct));
    const takeProfit = round(p.side === "LONG" ? entry * (1 + stopPct * 2.2) : entry * (1 - stopPct * 2.2));
    const liquidation = round(p.side === "LONG" ? entry * (1 - 1 / lev + 0.005) : entry * (1 + 1 / lev - 0.005));
    return {
      ...p,
      entry: round(entry),
      markPrice: realPrice,
      stopLoss,
      takeProfit,
      liquidation,
      unrealizedPnl: round((p.sizeUsd * pnlPct) / 100, 2),
      unrealizedPnlPct: round(pnlPct, 2),
    };
  });
}

// ---------- 执行日志价格锚定 ----------
// 订单执行日志里的预期/实际成交价也锚定到实时价格，避免出现
// 与实时行情脱节的 Mock 历史成交价。
function syncOrders(snapshot: TradingSnapshot): void {
  snapshot.orders = snapshot.orders.map((o) => {
    const asset = snapshot.assets[o.symbol];
    if (!asset) return o;
    const realPrice = asset.price;
    const expected = round(realPrice);
    const actual = round(realPrice * (1 + o.slippage / 100));
    return {
      ...o,
      expectedPrice: expected,
      actualPrice: actual,
      price: actual,
    };
  });
}

// ---------- 编排入口 ----------
export async function reconcileLiveMarket(
  snapshot: TradingSnapshot,
  symbols: string[],
  fetchCandles: CandleFetcher,
): Promise<void> {
  const candlesBySymbol: Record<string, Candle[]> = {};
  await Promise.all(
    symbols.map(async (s) => {
      try {
        const candles = await getCandlesCached(s, "4H", 140, fetchCandles);
        if (Array.isArray(candles) && candles.length > 60) candlesBySymbol[s] = candles;
      } catch {
        // 单个币取数失败则保留其 Mock 信号，不阻塞整体
      }
    }),
  );

  for (const s of symbols) {
    const asset = snapshot.assets[s];
    const candles = candlesBySymbol[s];
    if (!asset || !candles) continue;
    snapshot.signals[s] = computeLiveSignal(s, asset, candles);
  }

  const regimeSymbol = symbols[0] ?? "BTCUSDT";
  const regimeAsset = snapshot.assets[regimeSymbol];
  const regimeCandles = candlesBySymbol[regimeSymbol];
  if (regimeAsset && regimeCandles) {
    snapshot.regime = computeLiveRegime(regimeSymbol, regimeAsset, regimeCandles);
  }

  syncPositions(snapshot);
  syncOrders(snapshot);
}