// =============================================================
// AI / 规则引擎摘要
// 所有判断必须引用实际指标数值，不脱离数据自行判断。
// 缺省使用确定性规则生成；配置 VITE_AI_API_URL 后可替换为真实 LLM。
// =============================================================
import type { ScoredCoin, CoinSummary } from "../types";
import { MONEY_FLOW_LABELS } from "../config/narratives";
import { fmtPct } from "../utils/format";

export function buildSummary(c: ScoredCoin): CoinSummary {
  const whyStrong: string[] = [];
  const whyWeak: string[] = [];

  // ---- 强势理由（引用实际指标） ----
  if (c.rsBtc > 5) whyStrong.push(`相对 BTC 强 ${fmtPct(c.rsBtc)}`);
  if (c.returnsPct.d7 > 8) whyStrong.push(`7D ${fmtPct(c.returnsPct.d7)}`);
  if (c.volume.changePct > 60)
    whyStrong.push(`成交量放大 ${fmtPct(c.volume.changePct)}`);
  if (c.holder.d7 > 10) whyStrong.push(`Holder 7D ${fmtPct(c.holder.d7)}`);
  if (c.smartMoney.netflow > 20)
    whyStrong.push(`Smart Money 净流入 ${c.smartMoney.netflow.toFixed(0)}`);
  if (c.narrative.freshness > 70)
    whyStrong.push(`新叙事（新鲜度 ${c.narrative.freshness.toFixed(0)}）`);
  const ev = c.catalyst.events[0];
  if (ev) whyStrong.push(`有催化：${ev.label}`);

  // ---- 弱势理由 ----
  if (c.returnsPct.ytd < 0) whyWeak.push(`YTD ${fmtPct(c.returnsPct.ytd)}`);
  if (c.rsBtc < 0) whyWeak.push(`相对 BTC 弱 ${fmtPct(c.rsBtc)}`);
  if (c.holder.d7 < 0) whyWeak.push(`Holder ${fmtPct(c.holder.d7)}`);
  if (c.smartMoney.netflow < 0)
    whyWeak.push(`Smart Money 净流出 ${c.smartMoney.netflow.toFixed(0)}`);
  if (c.volume.changePct < -20)
    whyWeak.push(`成交量下降 ${fmtPct(c.volume.changePct)}`);
  if (c.catalyst.events.length === 0) whyWeak.push("无明确催化剂");

  // ---- 当前阶段 ----
  let stage: string;
  if (c.isRecovery) stage = "反转初期（由弱转强）";
  else if (c.grade === "S") stage = "强势主升阶段";
  else if (c.grade === "A") stage = "上升趋势确认";
  else if (c.grade === "B") stage = "震荡蓄势，等待催化剂";
  else if (c.strongC) stage = "深度弱势阶段";
  else stage = "弱势震荡阶段";

  // ---- 资金是否正在进入 ----
  const moneyFlow = `${MONEY_FLOW_LABELS[c.moneyFlow]}（净流 ${c.smartMoney.netflow.toFixed(0)}）`;

  // ---- 最大风险 ----
  let risk: string;
  if (c.isMeme && c.meme) {
    risk = `Meme 高风险：Top10 集中度 ${c.meme.top10ConcentrationPct.toFixed(0)}%、捆绑钱包 ${c.meme.bundledWalletsPct.toFixed(0)}%、开发者抛售 ${c.meme.devSellingPct.toFixed(0)}%`;
  } else if (c.strongC) {
    risk = "多项弱势条件叠加，存在继续阴跌风险";
  } else if (whyWeak.length > 0) {
    risk = whyWeak[0];
  } else {
    risk = "估值与流动性波动风险";
  }

  return {
    whyStrong: whyStrong.length ? whyStrong : ["暂无显著强势信号"],
    whyWeak: whyWeak.length ? whyWeak : ["暂无显著弱势信号"],
    stage,
    moneyFlow,
    worthAdding: c.recommendation !== "REMOVE",
    risk,
    recommendation: c.recommendation,
  };
}