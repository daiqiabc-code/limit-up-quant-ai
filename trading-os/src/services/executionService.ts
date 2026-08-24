// ============================================================
// ExecutionService — 订单与执行质量
// ============================================================
import type { ExecutionStats, Order } from "@/types";
import type { ExchangeProvider } from "./provider";

export class ExecutionService {
  constructor(private readonly provider: ExchangeProvider) {}

  getOrders(): Promise<Order[]> {
    return this.provider.getOrders();
  }

  async getExecutionStats(symbols: string[]): Promise<ExecutionStats> {
    const snap = await this.provider.getSnapshot(symbols);
    return snap.executionStats;
  }

  createOrder(order: Partial<Order>): Promise<Order> {
    return this.provider.createOrder(order);
  }

  cancelOrder(orderId: string): Promise<void> {
    return this.provider.cancelOrder(orderId);
  }
}