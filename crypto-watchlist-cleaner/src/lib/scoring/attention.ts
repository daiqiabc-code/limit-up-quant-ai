// =============================================================
// 因子 6：Market Attention（满分 10）
//   关注度增长率(6) + 当前热度(4)
//   强调 Attention Growth Rate，而非只看当前热度。
// =============================================================
import type { TokenRaw } from "../types";
import { scale, clamp } from "./helpers";

export function attentionScore(c: TokenRaw): number {
  const growth = scale(c.attention.growthPct, -55, 130, 0, 6);
  const base = scale(c.attention.base, 0, 100, 0, 4);
  return clamp(growth + base, 0, 10);
}