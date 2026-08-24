// ============================================================
// Service Layer — 统一入口
// 所有 service 调用同一个 Provider 实例。切换 Provider 只改这里。
// ============================================================
import type { ExchangeProvider } from "./provider";
import { createMockProvider } from "./mock/provider";
import { COINS } from "./mock/universe";

export function createDefaultProvider(): ExchangeProvider {
  return createMockProvider({ symbols: COINS.map((c) => c.symbol), seed: 20260824 });
}

export type { ExchangeProvider, ProviderConfig, ProviderFactory } from "./provider";
export * from "./marketService";
export * from "./signalService";
export * from "./portfolioService";
export * from "./riskService";
export * from "./executionService";
export * from "./journalService";
export * from "./strategyService";