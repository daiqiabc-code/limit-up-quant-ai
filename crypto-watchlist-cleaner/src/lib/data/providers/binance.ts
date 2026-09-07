// =============================================================
// Binance / OKX Provider —— 真实行情数据源（无需 API Key）
//
// 仅提供「价格 / 涨跌幅 / 成交量 / MA」等行情指标，
// 市值、Holder、Smart Money、叙事、催化等基本面字段
//        → 由 marketBuilder 估算或置中性（见其文件说明）。
// 对空数据、限频、个体请求失败均做处理，避免整体崩溃触发回退。
// =============================================================
import type { TokenRaw } from "../../types";
import { ProviderError, type TokenProvider } from "./types";
import { apiGetJson, mapLimit } from "./fetch";
import {
  buildMarketToken,
  computePriceMetrics,
  type RawCandle,
} from "./marketBuilder";

const MAX_COINS = 200; // 按成交额排序后拉取日线的币数上限（控制请求量）
const KLINES_LIMIT = 265; // 日线根数，覆盖 MA200 与 YTD
const PARALLEL = 8; // 日线请求并发数

// =============================================================
// Binance
// =============================================================
const BINANCE_BASE =
  (import.meta.env.VITE_BINANCE_API_URL as string | undefined) ||
  "https://data-api.binance.vision";

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  count: number;
}
interface BinanceExchangeInfo {
  symbols: { symbol: string; status: string; baseAsset: string; quoteAsset: string }[];
}

export class BinanceProvider implements TokenProvider {
  readonly name = "binance";

  async fetchTokens(): Promise<TokenRaw[]> {
    // 并行拉取交易对信息与全量 24H 行情
    const [info, tickers] = await Promise.all([
      apiGetJson<BinanceExchangeInfo>(`${BINANCE_BASE}/api/v3/exchangeInfo`),
      apiGetJson<BinanceTicker[]>(`${BINANCE_BASE}/api/v3/ticker/24hr`),
    ]);

    const tmap = new Map<string, BinanceTicker>();
    for (const t of tickers) tmap.set(t.symbol, t);

    // 仅保留 TRADING 状态的 USDT 现货交易对
    const symbols = info.symbols
      .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT" && tmap.has(s.symbol))
      .map((s) => ({ symbol: s.symbol, base: s.baseAsset, ticker: tmap.get(s.symbol)! }))
      // 按 24H 成交额降序，取 Top N
      .sort((a, b) => Number(b.ticker.quoteVolume) - Number(a.ticker.quoteVolume))
      .slice(0, MAX_COINS);

    if (symbols.length === 0) {
      throw new ProviderError("Binance 未返回任何 USDT 交易对", "empty");
    }

    // 并发拉取日线；单个失败不阻塞整体（返回 null 后过滤）
    const rows = await mapLimit(
      symbols,
      async ({ symbol, base, ticker }) => {
        try {
          const kl = await apiGetJson<(string | number)[][]>(
            `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=1d&limit=${KLINES_LIMIT}`,
          );
          return buildToken(base, Number(ticker.lastPrice), Number(ticker.priceChangePercent), Number(ticker.quoteVolume), ticker.count, "Binance", kl);
        } catch {
          return null;
        }
      },
      PARALLEL,
    );

    const tokens = rows.filter((x): x is TokenRaw => x !== null);
    if (tokens.length === 0) {
      throw new ProviderError("Binance 行情均为空", "empty");
    }
    return tokens;
  }
}

// =============================================================
// OKX
// =============================================================
const OKX_BASE = "https://www.okx.com";

interface OkxInstrument {
  instId: string;
  baseCcy: string;
  quoteCcy: string;
  state: string;
}
interface OkxTicker {
  instId: string;
  last: string;
  open24h: string;
  volCcy24h: string;
}

export class OkxProvider implements TokenProvider {
  readonly name = "okx";

  async fetchTokens(): Promise<TokenRaw[]> {
    const [instrRes, tickerRes] = await Promise.all([
      apiGetJson<{ data: OkxInstrument[] }>(`${OKX_BASE}/api/v5/public/instruments?instType=SPOT`),
      apiGetJson<{ data: OkxTicker[] }>(`${OKX_BASE}/api/v5/market/tickers?instType=SPOT`),
    ]);

    const tmap = new Map<string, OkxTicker>();
    for (const t of tickerRes.data ?? []) tmap.set(t.instId, t);

    const symbols = (instrRes.data ?? [])
      .filter((i) => i.state === "live" && i.quoteCcy === "USDT" && tmap.has(i.instId))
      .map((i) => ({ instId: i.instId, base: i.baseCcy, ticker: tmap.get(i.instId)! }))
      .sort((a, b) => Number(b.ticker.volCcy24h) - Number(a.ticker.volCcy24h))
      .slice(0, MAX_COINS);

    if (symbols.length === 0) {
      throw new ProviderError("OKX 未返回任何 USDT 现货", "empty");
    }

    const rows = await mapLimit(
      symbols,
      async ({ instId, base, ticker }) => {
        try {
          // OKX 日线为倒序（最新在前），转换为升序 RawCandle
          const res = await apiGetJson<{ data: (string | number)[][] }>(
            `${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=1D&limit=${KLINES_LIMIT}`,
          );
          const candles: RawCandle[] = (res.data ?? [])
            .slice()
            .reverse()
            .map((k) => ({
              openTime: Number(k[0]),
              open: Number(k[1]),
              close: Number(k[4]),
              quoteVolume: Number(k[7]),
            }));
          const last = Number(ticker.last);
          const d1 = Number(ticker.open24h) > 0 ? (last / Number(ticker.open24h) - 1) * 100 : 0;
          const vol24h = Number(ticker.volCcy24h);
          const metrics = computePriceMetrics(candles, last, d1, vol24h);
          return buildMarketToken({
            id: instId.toLowerCase().replace("-", ""),
            symbol: base,
            name: base,
            chain: "OKX",
            price: last,
            volume24h: vol24h,
            trades: 0,
            metrics,
          });
        } catch {
          return null;
        }
      },
      PARALLEL,
    );

    const tokens = rows.filter((x): x is TokenRaw => x !== null);
    if (tokens.length === 0) {
      throw new ProviderError("OKX 行情均为空", "empty");
    }
    return tokens;
  }
}

/** 组装 Binance TokenRaw（复用 marketBuilder 的指标计算） */
function buildToken(
  symbol: string,
  lastPrice: number,
  d1: number,
  volume24h: number,
  trades: number,
  chain: string,
  rawKlines: (string | number)[][],
): TokenRaw | null {
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  const candles: RawCandle[] = rawKlines.map((k) => ({
    openTime: Number(k[0]),
    open: Number(k[1]),
    close: Number(k[4]),
    quoteVolume: Number(k[7]),
  }));
  const metrics = computePriceMetrics(candles, lastPrice, d1, volume24h);
  return buildMarketToken({
    id: symbol.toLowerCase(),
    symbol,
    name: symbol,
    chain,
    price: lastPrice,
    volume24h,
    trades,
    metrics,
  });
}