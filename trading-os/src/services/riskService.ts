// ============================================================
// RiskService — 风控快照
// ============================================================
import type { RiskSnapshot } from "@/types";
import type { ExchangeProvider } from "./provider";

export class RiskService {
  constructor(private readonly provider: ExchangeProvider) {}

  async getRiskSnapshot(symbols: string[]): Promise<RiskSnapshot> {
    const snap = await this.provider.getSnapshot(symbols);
    return snap.risk;
  }
}