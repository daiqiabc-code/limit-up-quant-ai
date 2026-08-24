// ============================================================
// REST Exchange Provider 基类
// 组合 Mock Provider 作为降级兜底：真实行情优先，失败时自动回退，
// 并明确标记 dataSource / degraded。私有交易接口（需 API Key）默认禁用。
// ============================================================
import type { Asset, Candle, MarketRegime, Order, Position, Signal, TradingSnapshot } from "@/types";
import type { ExchangeProvider, ProviderConfig } from "@/services/provider";
import { MockExchangeProvider } from "@/services/mock/provider";

export interface FetchedAsset {
  symbol: string;
  base: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  fundingRate?: number;
  openInterest?: number;
}

export async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

export abstract class RestExchangeProvider implements ExchangeProvider {
  abstract readonly id: "okx" | "binance";
  abstract readonly displayName: string;
  readonly supportsLive = true;
  degraded: "LIVE" | "MOCK" | "FALLBACK" = "FALLBACK";

  protected mock: MockExchangeProvider;
  protected symbols: string[];
  protected credentials: ProviderConfig["credentials"];
  protected liveTrading: boolean;

  constructor(config: ProviderConfig) {
    this.mock = new MockExchangeProvider(config);
    this.symbols = config.symbols;
    this.credentials = config.credentials;
    this.liveTrading = config.liveTrading ?? false;
  }

  /** 仅当已配置完整凭证时才认为具备真实交易能力 */
  protected hasCredentials(): boolean {
    const c = this.credentials;
    return Boolean(c?.apiKey && c?.apiSecret);
  }

  // ---- 子类实现：符号映射 + 行情抓取 ----
  protected abstract fetchTickers(symbols: string[]): Promise<Record<string, Asset>>;
  protected abstract fetchCandles(symbol: string, timeframe: string, limit: number): Promise<Candle[]>;

  // ---- 行情（真实优先，降级 Mock）----
  async getTicker(symbol: string): Promise<Asset> {
    try {
      const r = await this.fetchTickers([symbol]);
      this.degraded = "LIVE";
      return r[symbol];
    } catch {
      this.degraded = "FALLBACK";
      return this.mock.getTicker(symbol);
    }
  }

  async getTickers(symbols: string[]): Promise<Record<string, Asset>> {
    try {
      const r = await this.fetchTickers(symbols);
      this.degraded = "LIVE";
      return r;
    } catch {
      this.degraded = "FALLBACK";
      return this.mock.getTickers(symbols);
    }
  }

  async getCandles(symbol: string, timeframe: string, limit = 300): Promise<Candle[]> {
    try {
      const r = await this.fetchCandles(symbol, timeframe, limit);
      this.degraded = "LIVE";
      return r;
    } catch {
      this.degraded = "FALLBACK";
      return this.mock.getCandles(symbol, timeframe, limit);
    }
  }

  // ---- 账户 / 分析（真实交易默认关闭，无凭证）----
  getPositions(): Promise<Position[]> {
    return this.mock.getPositions();
  }
  getBalance(): Promise<import("@/types").ExchangeAccount> {
    return this.mock.getBalance();
  }
  getOrders(): Promise<Order[]> {
    return this.mock.getOrders();
  }
  getRegime(symbol: string): Promise<MarketRegime> {
    return this.mock.getRegime(symbol);
  }
  getSignals(symbols: string[]): Promise<Record<string, Signal>> {
    return this.mock.getSignals(symbols);
  }
  async createOrder(order: Partial<Order>): Promise<Order> {
    // 未显式开启真实交易或未配置凭证 => 一律拒绝，绝不静默产生真实订单
    const base = await this.mock.createOrder(order);
    return { ...base, status: "REJECTED" };
  }
  cancelOrder(_orderId: string): Promise<void> {
    return Promise.resolve();
  }

  async getSnapshot(symbols: string[]): Promise<TradingSnapshot> {
    const snap = await this.mock.getSnapshot(symbols);
    try {
      snap.assets = await this.fetchTickers(symbols);
      snap.exchange = this.displayName;
      snap.dataSource = this.id === "okx" ? "LIVE_OKX" : "LIVE_BINANCE";
      snap.liveTradingEnabled = this.liveTrading && this.hasCredentials();
      this.degraded = "LIVE";
    } catch {
      snap.dataSource = "FALLBACK";
      snap.liveTradingEnabled = false;
      this.degraded = "FALLBACK";
    }
    return snap;
  }
}