// ============================================================
// Binance Provider（现货行情）
// 直接访问 Binance 公开市场端点（支持 CORS），浏览器侧即可取得真实实时行情，
// 无需本地服务端代理，故可在纯静态托管（如 GitHub Pages）上运行。
// 私有交易默认关闭。
// ============================================================
import type { Asset, Candle } from "@/types";
import { RestExchangeProvider, fetchJson } from "./base";

const REST = "https://data-api.binance.vision";

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
};

// Binance kline: [openTime, open, high, low, close, volume, ...]
type BinanceKline = [number, string, string, string, string, string];

const INTERVAL: Record<string, string> = {
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

export class BinanceProvider extends RestExchangeProvider {
  readonly id = "binance" as const;
  readonly displayName = "BINANCE";

  async fetchTickers(symbols: string[]): Promise<Record<string, Asset>> {
    const body = await fetchJson(
      `${REST}/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
    );
    const arr = body as BinanceTicker[];
    if (!Array.isArray(arr)) throw new Error("Binance 行情为空");
    const out: Record<string, Asset> = {};
    for (const t of arr) {
      const base = t.symbol.replace(/USDT$/, "");
      out[t.symbol] = {
        symbol: t.symbol,
        base,
        quote: "USDT",
        name: base,
        price: parseFloat(t.lastPrice),
        change24h: parseFloat(t.priceChangePercent ?? "0"),
        volume24h: parseFloat(t.quoteVolume ?? "0"),
        fundingRate: 0,
        openInterest: 0,
        high24h: parseFloat(t.highPrice ?? t.lastPrice),
        low24h: parseFloat(t.lowPrice ?? t.lastPrice),
      };
    }
    return out;
  }

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const interval = INTERVAL[timeframe] ?? "4h";
    const body = await fetchJson(
      `${REST}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`,
    );
    const rows = body as BinanceKline[];
    return (Array.isArray(rows) ? rows : []).map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }
}