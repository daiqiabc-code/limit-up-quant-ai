// =============================================================
// 因子 1：Price Strength（满分 20）
//   相对 BTC 强度(12) + MA 趋势结构(5) + 短期动量(3)
// =============================================================
import type { TokenRaw } from "../types";
import { computeRelativeStrength } from "./relativeStrength";
import { scale, clamp } from "./helpers";

/** MA 多头排列结构评分（价格 > MA20 > MA50 > MA200） */
function maTrendPoints(c: TokenRaw): number {
  const { ma20, ma50, ma200 } = c.maDeltaPct;
  let pts = 0;
  // 价格站上 MA20
  if (ma20 > 0) pts += 2;
  // MA20 > MA50（仅上线足够久才有意义）
  if (c.listedDays >= 100 && ma50 > 0 && ma50 > ma20) pts += 1.5;
  // MA50 > MA200（长线）
  if (c.listedDays >= 200 && ma200 > 0 && ma200 > ma50) pts += 1.5;
  return clamp(pts, 0, 5);
}

export function priceStrengthScore(c: TokenRaw): number {
  const { rsBtc } = computeRelativeStrength(c.returnsPct);
  const rsPts = scale(rsBtc, -55, 55, 0, 12);
  const trendPts = maTrendPoints(c);
  const momPts = scale(c.returnsPct.d7, -24, 55, 0, 3);
  return clamp(rsPts + trendPts + momPts, 0, 20);
}