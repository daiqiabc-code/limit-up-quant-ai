// =============================================================
// 数据源 Provider 抽象
// 所有数据源实现统一接口，便于无缝接入 CoinGecko / Binance / DexScreener 等。
// =============================================================
import type { TokenRaw } from "../../types";

export interface TokenProvider {
  /** 数据源名称（用于展示与调试） */
  readonly name: string;
  /** 拉取全市场币种原始指标 */
  fetchTokens(): Promise<TokenRaw[]>;
}

/** 数据源异常（限频 / 未配置 / 空数据 / 网络错误） */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured" | "rate_limited" | "empty" | "network",
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** 判断是否为限频错误 */
export function isRateLimited(e: unknown): boolean {
  return e instanceof ProviderError && e.kind === "rate_limited";
}

/** 判断是否为未配置错误 */
export function isNotConfigured(e: unknown): boolean {
  return e instanceof ProviderError && e.kind === "not_configured";
}