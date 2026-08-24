// ============================================================
// Binance Provider（现货行情）
// 公开接口无需 API Key；私有交易默认关闭。
// ============================================================
import type { Asset, Candle } from "@/types";
import { RestExchangeProvider, fetchJson } from "./base";

const REST = "https://api.binance.com";

export class BinanceProvider extends RestExchangeProvider {
  readonly id = "binance" as const;
  readonly displayName = "BINANCE";

  async fetchTickers(symbols: string[]): Promise<Record<string, Asset>> {
    const out: Record<string, Asset> = {};
    await Promise.all(
      symbols.map(async (s) => {
        const j = (await fetchJson(`${REST}/api/v3/ticker/24hr?symbol=${s}`)) as {
          lastPrice?: string;
          priceChangePercent?: string;
          quoteVolume?: string;
          highPrice?: string;
          lowPrice?: string;
        };
        if (!j.lastPrice) throw new Error(`Binance ticker empty for ${s}`);
        out[s] = {
          symbol: s,
          base: s.replace("USDT", ""),
          quote: "USDT",
          name: s.replace("USDT", ""),
          price: parseFloat(j.lastPrice),
          change24h: parseFloat(j.priceChangePercent ?? "0"),
          volume24h: parseFloat(j.quoteVolume ?? "0"),
          fundingRate: 0,
          openInterest: 0,
          high24h: parseFloat(j.highPrice ?? j.lastPrice),
          low24h: parseFloat(j.lowPrice ?? j.lastPrice),
        };
      }),
    );
    return out;
  }

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const interval = timeframe === "1D" ? "1d" : timeframe === "1W" ? "1w" : timeframe === "1H" ? "1h" : "4h";
    const j = (await fetchJson(`${REST}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`)) as unknown[][];
    return j.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }));
  }
}