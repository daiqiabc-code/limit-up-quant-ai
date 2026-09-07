// =============================================================
// 分级逻辑：S / A / B / C
// S 级不是简单按总分排序，必须同时满足趋势/相对强度/量/持有人/资金/叙事/催化等条件。
// =============================================================
import type { TokenRaw, KillCondition, Grade, Recommendation } from "../types";
import { computeRelativeStrength } from "./relativeStrength";
import { narrative100 } from "./narrative";
import { catalyst100 } from "./catalyst";
import { THRESHOLDS } from "../config/thresholds";

/** S 级候选：满足多数硬性条件 */
export function isSCandidate(c: TokenRaw): boolean {
  const t = THRESHOLDS.sCandidate;
  const volRatio = c.volume24h / Math.max(c.volume.avg30d, 1);
  const rs = computeRelativeStrength(c.returnsPct).rsBtc;

  const conditions = [
    c.maDeltaPct.ma20 > 0, // 价格 > MA20
    c.listedDays < 200 || c.maDeltaPct.ma200 > 0, // 长线 MA200（新币动态放宽）
    rs > 0, // RS vs BTC > 0
    volRatio > t.volRatio, // 量价配合
    c.holder.h24 > t.holder24h, // Holder 24H 增长
    c.smartMoney.netflow > t.smartMoneyNetflow, // Smart Money 净流入
    narrative100(c) > t.narrativeScore, // Narrative Score > 70
    catalyst100(c) > t.catalystScore, // Catalyst Score > 50
  ];
  const count = conditions.filter(Boolean).length;
  return count >= 6; // 满足至少 6/8
}

export interface GradeResult {
  grade: Grade;
  strongC: boolean;
  recommendation: Recommendation;
}

export function gradeCoin(
  finalScore: number,
  killCount: number,
  isRecovery: boolean,
  isS: boolean,
): GradeResult {
  const g = THRESHOLDS.grade;
  const k = THRESHOLDS.kill;

  // 反转观察区：近期转强则不删除（前提是未触发删除阈值）
  if (isRecovery && killCount < k.gradeC) {
    return { grade: "B", strongC: false, recommendation: "WATCH" };
  }
  // 强删除
  if (killCount >= k.strongC) {
    return { grade: "C", strongC: true, recommendation: "REMOVE" };
  }
  // 删除
  if (killCount >= k.gradeC) {
    return { grade: "C", strongC: false, recommendation: "REMOVE" };
  }
  // S 级
  if (isS && finalScore >= g.S) {
    return { grade: "S", strongC: false, recommendation: "KEEP" };
  }
  if (finalScore >= g.A) {
    return { grade: "A", strongC: false, recommendation: "KEEP" };
  }
  if (finalScore >= g.B) {
    return { grade: "B", strongC: false, recommendation: "WATCH" };
  }
  return { grade: "C", strongC: false, recommendation: "REMOVE" };
}

/** 将 kill 条件转成中文短语（供 UI 标签复用） */
export const KILL_REASON_LABELS: Record<KillCondition, string> = {
  YTD_NEGATIVE: "YTD 为负",
  YTD_UNDER_BTC: "跑输 BTC",
  RS_90D_NEGATIVE: "90D 弱势",
  VOLUME_DECLINING: "成交量下降",
  HOLDER_DECLINING: "Holder 停滞",
  SM_OUTFLOW: "Smart Money 流出",
  NO_NEW_NARRATIVE: "无新叙事",
  NO_CATALYST: "无催化剂",
  MCAP_DECLINING: "市值下降",
  ACTIVITY_DECLINING: "活跃度下降",
};