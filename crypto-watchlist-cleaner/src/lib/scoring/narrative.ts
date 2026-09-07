// =============================================================
// 因子 5：Narrative（满分 15）
//   Narrative Score(0-100) + 赛道广度加成
//   新叙事高分、持续多年无新催化则降分（由 freshness 反映）。
// =============================================================
import type { TokenRaw } from "../types";
import { scale, clamp } from "./helpers";

/** 叙事综合分（0-100）：新鲜度 70% + 热度趋势 30% */
export function narrative100(c: TokenRaw): number {
  const f = clamp(c.narrative.freshness, 0, 100);
  const t = (clamp(c.narrative.trend, -100, 100) + 100) / 2;
  return clamp(f * 0.7 + t * 0.3, 0, 100);
}

export function narrativeScore(c: TokenRaw): number {
  const base = scale(narrative100(c), 0, 100, 0, 12);
  // 多个热门赛道叠加有少量加成（最多 +3）
  const breadth = Math.min(c.narrative.tags.length, 2) * 1.5;
  return clamp(base + breadth, 0, 15);
}