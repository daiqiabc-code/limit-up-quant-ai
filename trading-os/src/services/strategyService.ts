// ============================================================
// StrategyService — 策略绩效
// ============================================================
import type { StrategyPerformance } from "@/types";
import type { ExchangeProvider } from "./provider";

export class StrategyService {
  constructor(private readonly provider: ExchangeProvider) {}

  async getStrategies(symbols: string[]): Promise<StrategyPerformance[]> {
    const snap = await this.provider.getSnapshot(symbols);
    return snap.strategies;
  }
}