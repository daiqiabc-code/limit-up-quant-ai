// ============================================================
// Binance Provider（现货行情）
// 通过本地 /api/market/* 服务端代理访问 Binance 公开数据端点，
// 规避浏览器 CORS / 地域限制；私有交易默认关闭。
// ============================================================
import type { Asset, Candle } from "@/types";
import { RestExchangeProvider, fetchJson } from "./base";

export class BinanceProvider extends RestExchangeProvider {
  readonly id = "binance" as const;
  readonly displayName = "BINANCE";

  async fetchTickers(symbols: string[]): Promise<Record<string, Asset>> {
    const q = encodeURIComponent(symbols.join(","));
    const data = (await fetchJson(`/api/market/tickers?symbols=${q}`)) as Record<string, Asset>;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Binance 行情为空");
    return data;
  }

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const j = (await fetchJson(
      `/api/market/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(timeframe)}&limit=${limit}`,
    )) as Candle[];
    return Array.isArray(j) ? j : [];
  }
}