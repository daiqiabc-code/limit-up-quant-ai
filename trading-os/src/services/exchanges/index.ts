// ============================================================
// Provider 工厂
// 根据用户选择的 dataProvider 实例化对应 Provider。
// 切换数据源无需改动前端组件。
// ============================================================
import type { ExchangeProvider, ProviderConfig } from "@/services/provider";
import { MockExchangeProvider } from "@/services/mock/provider";
import { OkxProvider } from "./okx";
import { BinanceProvider } from "./binance";

export type DataProviderId = "MOCK" | "OKX" | "BINANCE";

export function createProvider(id: DataProviderId, config: ProviderConfig): ExchangeProvider {
  switch (id) {
    case "OKX":
      return new OkxProvider(config);
    case "BINANCE":
      return new BinanceProvider(config);
    case "MOCK":
    default:
      return new MockExchangeProvider(config);
  }
}

export { OkxProvider, BinanceProvider };