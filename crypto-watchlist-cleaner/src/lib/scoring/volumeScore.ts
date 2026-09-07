// =============================================================
// 因子 2：Volume / Liquidity（满分 15）
//   流动性(5) + 成交量变化(6) + 量价配合(4)
//   重点：价格上涨 + 成交量放大 → 高分；价升量缩 → 扣分。
// =============================================================
import type { TokenRaw } from "../types";
import { scale, clamp } from "./helpers";

export function volumeScore(c: TokenRaw): number {
  // 流动性：成交额/市值 + 买卖深度
  const liq =
    0.5 * scale(c.volume.volToMc, 0, 0.5, 0, 5) +
    0.5 * scale(c.volume.depth, 0, 100, 0, 5);
  // 成交量变化（相对 30D 均值）
  const chg = scale(c.volume.changePct, -70, 240, 0, 6);

  // 量价配合
  let conf = 0;
  const up = c.returnsPct.d7 > 0;
  const volUp = c.volume.changePct > 0;
  if (up && volUp) conf = 4; // 价量齐升
  else if (up && !volUp) conf = 1; // 价升量缩（扣分）
  else if (!up && volUp) conf = 2; // 放量下跌

  return clamp(liq + chg + conf, 0, 15);
}