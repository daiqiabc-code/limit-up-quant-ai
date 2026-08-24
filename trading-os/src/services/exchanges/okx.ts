// ============================================================
// OKX Provider（现货行情）
// 公开接口无需 API Key；私有交易默认关闭。
// ============================================================
import type { Asset, Candle } from "@/types";
import { RestExchangeProvider, fetchJson } from "./base";

const REST = "https://www.okx.com";

export class OkxProvider extends RestExchangeProvider {
  readonly id = "okx" as const;
  readonly displayName = "OKX";

  protected toInstId(symbol: string): string {
    return `${symbol.replace("USDT", "")}-USDT`;
  }

  async fetchTickers(symbols: string[]): Promise<Record<string, Asset>> {
    const out: Record<string, Asset> = {};
    await Promise.all(
      symbols.map(async (s) => {
        const instId = this.toInstId(s);
        const j = (await fetchJson(`${REST}/api/v5/market/ticker?instId=${instId}`)) as {
          data?: { last?: string; open24h?: string; high24h?: string; low24h?: string; volCcy24h?: string; vol24h?: string }[];
        };
        const d = j.data?.[0];
        if (!d || !d.last) throw new Error(`OKX ticker empty for ${s}`);
        const price = parseFloat(d.last);
        const open = parseFloat(d.open24h ?? d.last);
        out[s] = {
          symbol: s,
          base: s.replace("USDT", ""),
          quote: "USDT",
          name: s.replace("USDT", ""),
          price,
          change24h: open ? ((price - open) / open) * 100 : 0,
          volume24h: parseFloat(d.volCcy24h ?? d.vol24h ?? "0"),
          fundingRate: 0,
          openInterest: 0,
          high24h: parseFloat(d.high24h ?? d.last),
          low24h: parseFloat(d.low24h ?? d.last),
        };
      }),
    );
    return out;
  }

  async fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]> {
    const instId = this.toInstId(symbol);
    const bar = timeframe === "1D" ? "1D" : timeframe === "1W" ? "1W" : timeframe === "1H" ? "1H" : "4H";
    const j = (await fetchJson(
      `${REST}/api/v5/market/candles?instId=${instId}&bar=${bar}&limit=${limit}`,
    )) as { data?: string[][] };
    const rows = j.data ?? [];
    // OKX 返回从新到旧，反转为时间升序
    return rows.slice().reverse().map((r) => ({
      time: Math.floor(parseFloat(r[0]) / 1000),
      open: parseFloat(r[1]),
      high: parseFloat(r[2]),
      low: parseFloat(r[3]),
      close: parseFloat(r[4]),
      volume: parseFloat(r[5]),
    }));
  }
}