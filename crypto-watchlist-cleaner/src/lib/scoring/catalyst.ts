// =============================================================
// 因子 7：Catalyst（满分 10）
//   未来 7 / 30 / 90 天催化评分加权（0.3 / 0.4 / 0.3）
// =============================================================
import type { TokenRaw } from "../types";
import { scale, clamp } from "./helpers";

/** 催化综合分（0-100） */
export function catalyst100(c: TokenRaw): number {
  return clamp(
    0.3 * c.catalyst.q7 + 0.4 * c.catalyst.q30 + 0.3 * c.catalyst.q90,
    0,
    100,
  );
}

export function catalystScore(c: TokenRaw): number {
  return clamp(scale(catalyst100(c), 0, 100, 0, 10), 0, 10);
}