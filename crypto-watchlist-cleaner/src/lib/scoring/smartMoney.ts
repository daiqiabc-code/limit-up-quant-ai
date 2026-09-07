// =============================================================
// 因子 4：Smart Money（满分 15）
//   Netflow(7) + Buy/Sell Ratio(3) + 新增钱包(2.5) + 持仓变化(2.5)
//   资金持续流入加分，持续流出扣分。
// =============================================================
import type { TokenRaw, MoneyFlowLabel } from "../types";
import { scale, clamp } from "./helpers";

/** 资金流标签 */
export function moneyFlowLabel(c: TokenRaw): MoneyFlowLabel {
  const n = c.smartMoney.netflow;
  if (n > 35) return "StrongInflow";
  if (n > 5) return "Inflow";
  if (n < -35) return "StrongOutflow";
  if (n < -5) return "Outflow";
  return "Neutral";
}

export function smartMoneyScore(c: TokenRaw): number {
  const sm = c.smartMoney;
  const flow = scale(sm.netflow, -90, 90, 0, 7);
  const ratio = scale(sm.buySellRatio, 0.2, 3, 0, 3);
  const nw = scale(sm.newWallets, -10, 180, 0, 2.5);
  const pos = scale(sm.positionChangePct, -40, 60, 0, 2.5);
  return clamp(flow + ratio + nw + pos, 0, 15);
}