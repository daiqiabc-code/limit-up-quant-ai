// ============================================================
// PortfolioService — 组合 / 仓位
// ============================================================
import type { ExchangeAccount, Position } from "@/types";
import type { ExchangeProvider } from "./provider";

export class PortfolioService {
  constructor(private readonly provider: ExchangeProvider) {}

  getPositions(): Promise<Position[]> {
    return this.provider.getPositions();
  }

  getBalance(): Promise<ExchangeAccount> {
    return this.provider.getBalance();
  }
}