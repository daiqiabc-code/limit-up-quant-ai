// =============================================================
// 因子 3：Holder Growth（满分 15）
//   持有人增长(9) + 加速度(3) + 极短期变化(3)
//   重点计算 Holder Acceleration：24H 年化增速 vs 7D 增速。
// =============================================================
import type { TokenRaw } from "../types";
import { scale, clamp } from "./helpers";

export function holderScore(c: TokenRaw): number {
  // 7D 增长
  const growth = scale(c.holder.d7, -20, 38, 0, 9);
  // 加速度：短期(24H×7) 是否快于 7D
  const accel = scale(c.holder.h24 * 7 - c.holder.d7, -40, 60, 0, 3);
  // 极短期 1H
  const short = scale(c.holder.h1, -4, 8, 0, 3);
  return clamp(growth + accel + short, 0, 15);
}