// =============================================================
// 趋势分类（Trend）
// 依据价格与 MA20/MA50/MA200 的关系 + 短期动量，
// 并支持按上市天数动态放宽（新币无 MA200）。
// =============================================================
import type { TokenRaw, TrendLabel } from "../types";

export function computeTrend(c: TokenRaw): TrendLabel {
  const { ma20, ma50, ma200 } = c.maDeltaPct;
  const d7 = c.returnsPct.d7;

  let score = ma20 > 0 ? 2 : -2;
  if (c.listedDays >= 100) score += ma50 > 0 ? 1 : -1;
  if (c.listedDays >= 200) score += ma200 > 0 ? 1 : -1;
  if (d7 > 3) score += 1;
  else if (d7 < -3) score -= 1;

  if (score >= 5) return "StrongUp";
  if (score >= 2) return "Up";
  if (score >= -1) return "Neutral";
  if (score >= -4) return "Down";
  return "StrongDown";
}