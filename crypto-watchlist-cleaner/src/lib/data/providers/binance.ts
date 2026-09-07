// =============================================================
// Binance / OKX Provider（骨架实现）
// 提供通用 Ticker → TokenRaw 的映射骨架，供后续接入现货行情。
// 未实现完整逻辑时显式抛 not_configured，由上层回退 Mock。
// =============================================================
import { ProviderError, type TokenProvider } from "./types";
import type { TokenRaw } from "../../types";

export class BinanceProvider implements TokenProvider {
  readonly name = "binance";

  async fetchTokens(): Promise<TokenRaw[]> {
    // Binance 现货需要额外端点（exchangeInfo + 24hrTicker + klines），
    // 现阶段返回未配置，上层自动回退 Mock。
    throw new ProviderError(
      "Binance 数据源尚未接入，请使用 Mock 或配置 CoinGecko",
      "not_configured",
    );
  }
}

export class OkxProvider implements TokenProvider {
  readonly name = "okx";

  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError(
      "OKX 数据源尚未接入，请使用 Mock 或配置 CoinGecko",
      "not_configured",
    );
  }
}