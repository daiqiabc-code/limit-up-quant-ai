// =============================================================
// Recovery Detection —— 反转检测
// 避免「YTD<0 就删除」的误杀：YTD 弱 ≠ 当前一定弱。
// 若 YTD<0 但近期（7D/30D/成交量/Holder/SmartMoney/叙事）明显转强，则不删除。
// =============================================================
import type { TokenRaw } from "../types";
import { THRESHOLDS } from "../config/thresholds";

export function detectRecovery(c: TokenRaw): boolean {
  const t = THRESHOLDS.recovery;
  // 前提：YTD 长期弱
  if (c.returnsPct.ytd >= 0) return false;

  const d7ok = c.returnsPct.d7 > t.d7;
  const d30ok = c.returnsPct.d30 > t.d30;
  // volRatio 1.6 → 换算成 +60% 成交额变化
  const volOk = c.volume.changePct > (t.volRatio - 1) * 100;
  const holderOk = c.holder.d7 > t.holderD7;
  const smOk = c.smartMoney.netflow > t.smartMoneyNetflow;
  const narrOk = c.narrative.trend > t.narrativeTrend;

  const conditions = [d7ok, d30ok, volOk, holderOk, smOk, narrOk];
  const count = conditions.filter(Boolean).length;
  // 需要至少 4 项近期转强，才认定为反转
  return count >= 4;
}