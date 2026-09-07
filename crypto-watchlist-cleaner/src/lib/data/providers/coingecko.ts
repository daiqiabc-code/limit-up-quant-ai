// =============================================================
// CoinGecko Provider（骨架实现）
// 配置 VITE_COINGECKO_API_KEY 后会尝试拉取真实 Top 币种；
// 仅价格/市值/成交额/涨跌幅可用，其余链上字段置中性默认值。
// 对限频(429)、空数据、网络错误做显式处理，调用方据此回退到 Mock。
// =============================================================
import type { TokenRaw } from "../../types";
import { ProviderError, type TokenProvider } from "./types";

const BASE = "https://api.coingecko.com/api/v3";
const KEY = import.meta.env.VITE_COINGECKO_API_KEY;

interface CGMarket {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  fully_diluted_valuation: number | null;
  total_volume: number | null;
  price_change_percentage_24h?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  price_change_percentage_1y_in_currency?: number | null;
  ath_change_percentage?: number | null;
  atl_change_percentage?: number | null;
  market_cap_change_percentage_24h?: number | null;
}

function toRaw(c: CGMarket, i: number): TokenRaw {
  const ret = (n?: number | null) => n ?? 0;
  const vol = ret(c.total_volume) || 0;
  const mc = ret(c.market_cap) || 0;
  return {
    id: c.id,
    symbol: (c.symbol || "").toUpperCase(),
    name: c.name || c.symbol,
    chain: "Cex",
    listedDays: 4000 - i * 20,
    isMeme: false,
    isRobinhood: false,
    price: ret(c.current_price),
    marketCap: mc,
    fdv: ret(c.fully_diluted_valuation) || mc,
    volume24h: vol,
    returnsPct: {
      d1: ret(c.price_change_percentage_24h),
      d7: ret(c.price_change_percentage_7d_in_currency),
      d30: ret(c.price_change_percentage_30d_in_currency),
      d90: 0,
      ytd: ret(c.price_change_percentage_1y_in_currency),
    },
    maDeltaPct: { ma20: 0, ma50: 0, ma200: 0 },
    volume: {
      avg7d: vol,
      avg30d: vol,
      changePct: 0,
      volToMc: mc > 0 ? vol / mc : 0,
      depth: 50,
    },
    holder: { h1: 0, h6: 0, h24: 0, d7: 0 },
    smartMoney: {
      netflow: 0,
      walletCount: 0,
      buySellRatio: 1,
      newWallets: 0,
      positionChangePct: 0,
    },
    narrative: { tags: ["Other"], freshness: 30, trend: 0 },
    attention: { base: 20, growthPct: 0, sources: {} },
    catalyst: { q7: 0, q30: 0, q90: 0, events: [] },
  };
}

export class CoinGeckoProvider implements TokenProvider {
  readonly name = "coingecko";

  async fetchTokens(): Promise<TokenRaw[]> {
    if (!KEY) {
      throw new ProviderError("未配置 VITE_COINGECKO_API_KEY", "not_configured");
    }
    const url = `${BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d,1y`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "x-cg-demo-api-key": KEY, "accept": "application/json" },
      });
    } catch (e) {
      throw new ProviderError(`CoinGecko 网络错误: ${(e as Error).message}`, "network");
    }
    if (res.status === 429) {
      throw new ProviderError("CoinGecko 触发限频（429）", "rate_limited");
    }
    if (!res.ok) {
      throw new ProviderError(`CoinGecko 返回 ${res.status}`, "network");
    }
    const data = (await res.json()) as CGMarket[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new ProviderError("CoinGecko 返回空数据", "empty");
    }
    return data.map(toRaw);
  }
}