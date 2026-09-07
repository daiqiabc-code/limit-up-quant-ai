// =============================================================
// 阈值配置：Kill Switch / 分级 / S 候选 / Recovery
// 所有筛选条件可配置。
// =============================================================
import type { Grade } from "../types";

export const THRESHOLDS = {
  // ---- Kill Switch ----
  kill: {
    /** 触发 C 级的最少条件数 */
    gradeC: 4,
    /** Strong C 的最少条件数 */
    strongC: 6,
    /** 视作成交额显著下降的阈值 (%) */
    volumeDeclinePct: -20,
    /** 视作活跃度下降的阈值 (%) */
    activityDeclinePct: -25,
    /** 无催化剂的判定阈值 */
    noCatalystThreshold: 15,
  },

  // ---- S/A/B/C 分级（finalScore） ----
  grade: {
    S: 80,
    A: 68,
    B: 52,
    /** 反转为 B 的最低分 */
    recovery: 48,
  } as Record<Grade, number> & { recovery: number },

  // ---- S 级候选算法门槛 ----
  sCandidate: {
    /** 24H 成交额 / 30D 均值 */
    volRatio: 1.5,
    /** Holder 24H 增长 > 0 */
    holder24h: 0,
    /** Smart Money 净流入 > 0 */
    smartMoneyNetflow: 0,
    /** Narrative Score > 70 */
    narrativeScore: 70,
    /** Catalyst Score > 50 */
    catalystScore: 50,
  },

  // ---- Recovery 检测 ----
  recovery: {
    d7: 8, // 7D 涨跌幅阈值 %
    d30: 5, // 30D 涨跌幅阈值 %
    volRatio: 1.6, // 成交量爆发倍数
    holderD7: 8, // 7D Holder 增长率 %
    smartMoneyNetflow: 10, // Smart Money 净流入
    narrativeTrend: 15, // 叙事热度上升
  },

  // ---- Meme Radar 市值区间（USD） ----
  meme: {
    under1m: 1_000_000,
    b1m_5m: 5_000_000,
    b5m_10m: 10_000_000,
    b10m_50m: 50_000_000,
  },
} as const;