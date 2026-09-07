// =============================================================
// Meme 专用评分模型（0-100）
// 权重侧重：Volume × Holder × Smart Money × Social，
// 并加入链上风险（开发抛售、捆绑钱包、集中度、LP）作为惩罚。
// =============================================================
import type { TokenRaw, RobinhoodStage } from "../types";
import { scale, clamp } from "./helpers";

const MKT_CAP_NOTE = "meme";

export function memeScore(c: TokenRaw): number {
  const m = c.meme;
  if (!m) return 0;

  const vol = scale(c.volume.changePct, -70, 240, 0, 20);
  const holder = scale(c.holder.d7, -20, 40, 0, 20);
  const sm = scale(c.smartMoney.netflow, -90, 90, 0, 20);
  const social = scale(m.socialAcceleration, -70, 90, 0, 20);
  const lp = scale(m.lpChangePct, -40, 120, 0, 10);

  // 风险惩罚（越小月健康，越接近满分）
  const risk =
    scale(m.devSellingPct, 0, 35, 0, 4) +
    scale(m.bundledWalletsPct, 0, 45, 0, 3) +
    scale(m.top10ConcentrationPct, 10, 80, 0, 3);
  const safe = clamp(10 - risk, 0, 10);

  return clamp(vol + holder + sm + social + lp + safe, 0, 100);
}

/** Robinhood Chain Meme 阶段扫描 */
export function robinhoodStage(c: TokenRaw): RobinhoodStage {
  const mom = c.returnsPct.d7;
  const vol = c.volume.changePct;
  const sm = c.smartMoney.netflow;

  // Dead：流动性衰退
  if (vol < -40 && mom < -10) return "Dead";
  // Distribution：价格仍高 + 资金流出 + 放量 → 高位派发
  if (mom > 5 && sm < -10 && vol > 60) return "Distribution";
  // Momentum：趋势确认（价格强 + 放量 + 资金流入）
  if (mom > 15 && vol > 60 && sm > 10) return "Momentum";
  // Breakout：开始突破（放量）
  if (mom > 5 && vol > 100) return "Breakout";
  // Early：可能刚启动
  return "Early";
}

export { MKT_CAP_NOTE };