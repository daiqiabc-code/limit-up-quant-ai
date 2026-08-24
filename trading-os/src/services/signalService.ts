// ============================================================
// SignalService — 信号与评分
// ============================================================
import type { Signal } from "@/types";
import type { ExchangeProvider } from "./provider";

export class SignalService {
  constructor(private readonly provider: ExchangeProvider) {}

  getSignals(symbols: string[]): Promise<Record<string, Signal>> {
    return this.provider.getSignals(symbols);
  }
}