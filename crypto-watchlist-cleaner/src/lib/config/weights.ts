// =============================================================
// 评分权重配置（总分 100）
// 所有评分公式独立成模块，权重集中在此，便于调整。
// =============================================================
import type { FactorScores } from "../types";

export const MAX_SCORE = 100;

/** 各因子的满分 */
export const FACTOR_MAX: FactorScores = {
  priceStrength: 20,
  volume: 15,
  holder: 15,
  smartMoney: 15,
  narrative: 15,
  attention: 10,
  catalyst: 10,
};

/** 各因子权重（当前与满分一致，等价于直接相加；保留用于未来调权） */
export const FACTOR_WEIGHT = {
  priceStrength: 0.2,
  volume: 0.15,
  holder: 0.15,
  smartMoney: 0.15,
  narrative: 0.15,
  attention: 0.1,
  catalyst: 0.1,
} as const;

/** 额外惩罚上限（负值） */
export const MAX_PENALTY = 25;

/** 相对 BTC 强度各窗口权重 */
export const RS_WINDOWS = [
  { key: "ytd", weight: 0.2 },
  { key: "d90", weight: 0.25 },
  { key: "d30", weight: 0.25 },
  { key: "d7", weight: 0.2 },
  { key: "d1", weight: 0.1 },
] as const;