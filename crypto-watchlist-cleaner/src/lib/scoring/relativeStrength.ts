// =============================================================
// 相对强度（Relative Strength vs BTC）
// 核心思想：不看绝对涨跌幅，而看「相对 BTC 的强弱」。
//   例：BTC +30%、某币 +50% → RS 强；BTC +30%、某币 -10% → RS 极弱。
// =============================================================
import type { TokenRaw } from "../types";
import { BTC_BENCHMARK } from "../data/mockData";
import { RS_WINDOWS } from "../config/weights";

export interface RelativeStrength {
  /** 组合相对强度（各窗口加权，单位 %） */
  rsBtc: number;
  /** 90D 相对强度 */
  rsBtc90d: number;
}

export function computeRelativeStrength(
  returnsPct: TokenRaw["returnsPct"],
): RelativeStrength {
  const btc = BTC_BENCHMARK.returnsPct;
  let rsBtc = 0;
  // 逐窗口做多空差，再按权重加权
  for (const w of RS_WINDOWS) {
    rsBtc += (returnsPct[w.key] - btc[w.key]) * w.weight;
  }
  return {
    rsBtc,
    rsBtc90d: returnsPct.d90 - btc.d90,
  };
}