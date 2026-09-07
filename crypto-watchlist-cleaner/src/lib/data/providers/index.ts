// =============================================================
// 数据源选择器 + 统一加载入口（含回退逻辑）
// =============================================================
import type { TokenRaw } from "../../types";
import { MockProvider } from "./mock";
import { CoinGeckoProvider } from "./coingecko";
import { BinanceProvider, OkxProvider } from "./binance";
import { DexScreenerProvider, BirdeyeProvider, GmgnProvider } from "./dexscreener";
import { isNotConfigured, type TokenProvider } from "./types";

export interface LoadedData {
  tokens: TokenRaw[];
  isDemo: boolean;
  dataSource: string;
  updatedAt: string;
  error?: string;
}

function getProvider(): TokenProvider {
  const src = (import.meta.env.VITE_DATA_SOURCE ?? "mock").toLowerCase();
  switch (src) {
    case "coingecko":
      return new CoinGeckoProvider();
    case "binance":
      return new BinanceProvider();
    case "okx":
      return new OkxProvider();
    case "dexscreener":
      return new DexScreenerProvider();
    case "birdeye":
      return new BirdeyeProvider();
    case "gmgn":
      return new GmgnProvider();
    case "mock":
    default:
      return new MockProvider();
  }
}

/**
 * 加载全市场原始数据。
 * 优先使用配置的数据源；异常（未配置/限频/空数据/网络）时统一回退到 Mock，
 * 并显式标记 isDemo = true，绝不把模拟数据伪装成实时数据。
 */
export async function loadRawTokens(): Promise<LoadedData> {
  const provider = getProvider();
  const updatedAt = new Date().toISOString();

  if (provider.name === "mock") {
    const mock = new MockProvider();
    return {
      tokens: await mock.fetchTokens(),
      isDemo: true,
      dataSource: "mock",
      updatedAt,
    };
  }

  try {
    const tokens = await provider.fetchTokens();
    if (!tokens || tokens.length === 0) {
      throw new Error("empty");
    }
    return { tokens, isDemo: false, dataSource: provider.name, updatedAt };
  } catch (e) {
    // 未配置/未接入 → 回退 Mock，但保留 error 提示
    const mock = new MockProvider();
    const msg =
      e instanceof Error ? e.message : "未知数据源错误";
    return {
      tokens: await mock.fetchTokens(),
      isDemo: true,
      dataSource: provider.name,
      updatedAt,
      error: isNotConfigured(e) ? msg : `${msg}（已回退 Demo 数据）`,
    };
  }
}