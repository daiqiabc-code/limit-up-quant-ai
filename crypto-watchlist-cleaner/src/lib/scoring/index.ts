// =============================================================
// 评分编排入口 —— computeAll(token) => ScoredCoin
// 组合七因子 + 惩罚 + Kill Switch + Recovery + 分级 + 摘要。
// =============================================================
import type { TokenRaw, ScoredCoin, FactorScores } from "../types";
import { priceStrengthScore } from "./priceStrength";
import { volumeScore } from "./volumeScore";
import { holderScore } from "./holder";
import { smartMoneyScore, moneyFlowLabel } from "./smartMoney";
import { narrativeScore, narrative100 } from "./narrative";
import { attentionScore } from "./attention";
import { catalystScore, catalyst100 } from "./catalyst";
import { computeRelativeStrength } from "./relativeStrength";
import { computeTrend } from "./trend";
import { killConditions, buildRemoveReasons } from "./killSwitch";
import { detectRecovery } from "./recovery";
import { isSCandidate, gradeCoin } from "./grade";
import { memeScore, robinhoodStage } from "./meme";
import { buildSummary } from "./aiSummary";
import { clamp } from "./helpers";
import { MAX_PENALTY } from "../config/weights";

/** 计算七因子得分 */
export function computeFactorScores(c: TokenRaw): FactorScores {
  return {
    priceStrength: priceStrengthScore(c),
    volume: volumeScore(c),
    holder: holderScore(c),
    smartMoney: smartMoneyScore(c),
    narrative: narrativeScore(c),
    attention: attentionScore(c),
    catalyst: catalystScore(c),
  };
}

/** 未含惩罚的原始总分（0-100） */
export function computeTotal(f: FactorScores): number {
  return (
    f.priceStrength +
    f.volume +
    f.holder +
    f.smartMoney +
    f.narrative +
    f.attention +
    f.catalyst
  );
}

/** 额外惩罚（负值），针对长期弱/RS弱/量缩/Holder降/资金流出/无叙事/无催化 */
export function computePenalty(c: TokenRaw): number {
  let p = 0;
  if (c.returnsPct.ytd < 0) p += 3;
  if (computeRelativeStrength(c.returnsPct).rsBtc90d < 0) p += 3;
  if (c.volume.changePct < -20) p += 2.5;
  if (c.holder.d7 < 0) p += 2.5;
  if (c.smartMoney.netflow < 0) p += 3;
  if (narrative100(c) < 25) p += 2;
  if (catalyst100(c) < 15) p += 2;
  if (c.returnsPct.d90 < 0) p += 2;
  if (c.volume.volToMc < 0.01) p += 1.5;
  return -clamp(p, 0, MAX_PENALTY);
}

/** 完整评分：原始币 → 评分结果 */
export function computeAll(token: TokenRaw): ScoredCoin {
  const factors = computeFactorScores(token);
  const totalScore = computeTotal(factors);
  const penalty = computePenalty(token);
  const finalScore = clamp(totalScore + penalty, 0, 100);

  const killHits = killConditions(token);
  const killCount = killHits.length;
  const isRecovery = detectRecovery(token);
  const isS = isSCandidate(token);

  const rs = computeRelativeStrength(token.returnsPct);
  const { grade, strongC, recommendation } = gradeCoin(
    finalScore,
    killCount,
    isRecovery,
    isS,
  );

  const meme = token.isMeme ? memeScore(token) : undefined;

  const base: Omit<ScoredCoin, "summary" | "rank"> = {
    ...token,
    scores: factors,
    totalScore,
    penalty,
    finalScore,
    rsBtc: rs.rsBtc,
    rsBtc90d: rs.rsBtc90d,
    trend: computeTrend(token),
    moneyFlow: moneyFlowLabel(token),
    killCount,
    killHits,
    isRecovery,
    isSCandidate: isS,
    strongC,
    grade,
    recommendation,
    removeReasons: buildRemoveReasons(token, killHits),
    memeScore: meme,
    robinhoodStage:
      token.isRobinhood || token.isMeme ? robinhoodStage(token) : undefined,
  };

  const summary = buildSummary(base as ScoredCoin);

  return { ...base, summary, rank: 0 };
}

/** 批量评分并按最终分排序，赋予 rank */
export function scoreAll(tokens: TokenRaw[]): ScoredCoin[] {
  const scored = tokens.map(computeAll);
  scored.sort((a, b) => b.finalScore - a.finalScore);
  scored.forEach((c, i) => (c.rank = i + 1));
  return scored;
}

export { priceStrengthScore, volumeScore, holderScore, smartMoneyScore };
export { narrativeScore, attentionScore, catalystScore };
export { computeRelativeStrength, computeTrend };
export { killConditions, buildRemoveReasons };
export { detectRecovery };
export { isSCandidate, gradeCoin };
export { memeScore, robinhoodStage };
export { buildSummary };