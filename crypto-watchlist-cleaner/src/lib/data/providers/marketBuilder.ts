// =============================================================
// 行情指标计算 + 通用 TokenRaw 组装工厂
//
// CeFi 行情源（Binance / OKX）只能提供「价格 / 涨跌幅 / 成交量 / MA」，
// 无法获得流通市值、Holder、Smart Money、链上叙事等基本面字段：
//   - marketCap / fdv   用「24H 成交额 ÷ 经验换手率」估算（量级近似，非真实市值）
//   - holder / smartMoney 置中性默认（需链上数据源补齐，属第三阶段）
//   - narrative / catalyst 置中性（无社交 / 事件数据）
// 所有估算与中性值均在代码中显式标注，避免伪装成实时数据。
// =============================================================
import type { TokenRaw } from "../../types";

/** 一根日线蜡烛（跨平台统一结构） */
export interface RawCandle {
  openTime: number;
  open: number;
  close: number;
  quoteVolume: number; // 以计价货币（USDT）计的成交额
}

/** 简单区间百分比：(cur/prev - 1) * 100，prev<=0 返回 0 */
function pct(cur: number, prev: number): number {
  return prev > 0 ? (cur / prev - 1) * 100 : 0;
}

function avg(arr: number[], n: number): number {
  const s = arr.slice(-n);
  if (s.length === 0) return 0;
  return s.reduce((a, b) => a + b, 0) / s.length;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 经验换手率估算市值。
 * 大市值币换手率低、小市值币换手率高（市场普遍规律）。
 * 仅用于量级近似，不是真实流通市值。
 */
export function estimateMarketCap(volume24h: number): number {
  if (volume24h <= 0) return 0;
  let turnover: number;
  if (volume24h > 5e9) turnover = 0.03;
  else if (volume24h > 5e8) turnover = 0.05;
  else if (volume24h > 5e7) turnover = 0.08;
  else if (volume24h > 5e6) turnover = 0.15;
  else turnover = 0.25;
  return volume24h / turnover;
}

/** 由日线序列计算多窗口涨跌幅、MA 偏差、成交量均值与上市天数 */
export function computePriceMetrics(
  candles: RawCandle[],
  lastPrice: number,
  d1: number, // 实时 24H 涨跌幅（来自 ticker）
  volume24h: number,
): {
  returnsPct: TokenRaw["returnsPct"];
  maDeltaPct: TokenRaw["maDeltaPct"];
  volume: { avg7d: number; avg30d: number; changePct: number };
  listedDays: number;
} {
  const closes = candles.map((c) => c.close);
  const qvols = candles.map((c) => c.quoteVolume);
  const now = closes.length ? closes[closes.length - 1] : lastPrice;
  const closeAgo = (d: number) =>
    closes[Math.max(0, closes.length - 1 - d)] ?? now;

  const d7 = pct(now, closeAgo(7));
  const d30 = pct(now, closeAgo(30));
  const d90 = pct(now, closeAgo(90));

  // YTD：当前年份首根日线的开盘价
  const curYear = new Date().getUTCFullYear();
  let ytdOpen = 0;
  for (const c of candles) {
    if (new Date(c.openTime).getUTCFullYear() === curYear) {
      ytdOpen = c.open;
      break;
    }
  }
  const ytd = ytdOpen > 0 ? pct(now, ytdOpen) : pct(now, closeAgo(closes.length - 1));

  const maDelta = (n: number) => {
    const s = closes.slice(-n);
    if (s.length < 2) return 0;
    const ma = s.reduce((a, b) => a + b, 0) / s.length;
    return pct(now, ma);
  };

  const avg7d = avg(qvols, 7);
  const avg30d = avg(qvols, 30);
  const changePct = avg30d > 0 ? (volume24h / avg30d - 1) * 100 : 0;

  const listedDays = candles.length
    ? Math.max(1, Math.round((Date.now() - candles[0].openTime) / 86400000))
    : 4000;

  return {
    returnsPct: { d1, d7, d30, d90, ytd },
    maDeltaPct: { ma20: maDelta(20), ma50: maDelta(50), ma200: maDelta(200) },
    volume: { avg7d, avg30d, changePct },
    listedDays,
  };
}

/** 组装一个 TokenRaw，行情字段真实，基本面字段估算/中性 */
export function buildMarketToken(input: {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  price: number;
  volume24h: number;
  trades: number; // 24H 成交笔数（活跃度代理）
  metrics: ReturnType<typeof computePriceMetrics>;
}): TokenRaw {
  const { price, volume24h, trades, metrics } = input;
  const mc = estimateMarketCap(volume24h);

  // 深度 / 关注度：由真实成交额与成交笔数推导（0-100 归一）
  const depth = clamp(10 + Math.log10(volume24h + 1) * 8, 0, 100);
  const attentionBase = clamp(
    25 + Math.log10(volume24h + 1) * 7 + Math.min(20, Math.log10(trades + 1) * 5),
    0,
    100,
  );
  // 关注度增长率：用 7D 涨幅作为近似的社媒/搜索热度代理
  const growthPct = clamp(metrics.returnsPct.d7, -100, 100);

  return {
    id: input.id,
    symbol: input.symbol,
    name: input.name,
    chain: input.chain,
    listedDays: metrics.listedDays,
    isMeme: false,
    isRobinhood: false,
    price,
    marketCap: mc,
    fdv: mc,
    volume24h,
    returnsPct: metrics.returnsPct,
    maDeltaPct: metrics.maDeltaPct,
    volume: {
      ...metrics.volume,
      volToMc: mc > 0 ? volume24h / mc : 0,
      depth,
    },
    // 链上/资金字段：CeFi 行情源无法获得，置中性（第三阶段由 DexScreener/链上补齐）
    holder: { h1: 0, h6: 0, h24: 0, d7: 0 },
    smartMoney: {
      netflow: 0,
      walletCount: 0,
      buySellRatio: 1,
      newWallets: 0,
      positionChangePct: 0,
    },
    narrative: { tags: ["Other"], freshness: 30, trend: 0 },
    attention: {
      base: attentionBase,
      growthPct,
      sources: { exchange: attentionBase },
    },
    catalyst: { q7: 0, q30: 0, q90: 0, events: [] },
  };
}