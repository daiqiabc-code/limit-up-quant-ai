// ============================================================
// MarketService — 行情与市场结构
// ============================================================
import type { Asset, Candle, MarketRegime, TradingSnapshot } from "@/types";
import type { ExchangeProvider } from "./provider";

export class MarketService {
  constructor(private readonly provider: ExchangeProvider) {}

  getTicker(symbol: string): Promise<Asset> {
    return this.provider.getTicker(symbol);
  }

  getTickers(symbols: string[]): Promise<Record<string, Asset>> {
    return this.provider.getTickers(symbols);
  }

  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]> {
    return this.provider.getCandles(symbol, timeframe, limit);
  }

  getRegime(symbol: string): Promise<MarketRegime> {
    return this.provider.getRegime(symbol);
  }

  getSnapshot(symbols: string[]): Promise<TradingSnapshot> {
    return this.provider.getSnapshot(symbols);
  }
}