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
  /** 该 Provider 是否具备真实行情能力（区别于纯 Mock） */
  readonly supportsLive: boolean;
  /** 供 UI 判断当前数据是真实还是降级 */
  readonly degraded: "LIVE" | "MOCK" | "FALLBACK";
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
  /** 真实账户凭证（可选，用于私有接口） */
  credentials?: ExchangeCredentials;
  /** 是否允许真实下单。默认 false —— 即使配置了凭证也绝不静默实盘。 */
  liveTrading?: boolean;
}

export interface ExchangeCredentials {
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
}