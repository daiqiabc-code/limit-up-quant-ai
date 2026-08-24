// ============================================================
// Provider 接口定义
// 第一阶段: Mock Provider；未来 OKX / Binance / Bybit 通过实现该接口替换。
// ============================================================
import type {
  Asset,
  Candle,
  ExchangeAccount,
  MarketRegime,
  Order,
  Position,
  Signal,
  TradingSnapshot,
} from "@/types";

export interface ExchangeProvider {
  readonly id: string;
  readonly displayName: string;
  getTicker(symbol: string): Promise<Asset>;
  getTickers(symbols: string[]): Promise<Record<string, Asset>>;
  getCandles(symbol: string, timeframe: string, limit?: number): Promise<Candle[]>;
  getPositions(): Promise<Position[]>;
  getBalance(): Promise<ExchangeAccount>;
  getOrders(): Promise<Order[]>;
  getRegime(symbol: string): Promise<MarketRegime>;
  getSignals(symbols: string[]): Promise<Record<string, Signal>>;
  getSnapshot(symbols: string[]): Promise<TradingSnapshot>;
  createOrder(order: Partial<Order>): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
}

export type ProviderFactory = (config?: ProviderConfig) => ExchangeProvider;

export interface ProviderConfig {
  symbols: string[];
  seed?: number;
}