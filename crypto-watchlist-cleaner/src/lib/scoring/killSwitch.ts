// =============================================================
// C 级 Kill Switch —— 自动删除模型
// 十项弱势条件，满足 4 条以上 → C 级；6 条以上 → Strong C → REMOVE。
// =============================================================
import type { TokenRaw, KillCondition } from "../types";
import { computeRelativeStrength } from "./relativeStrength";
import { catalyst100 } from "./catalyst";
import { BTC_BENCHMARK } from "../data/mockData";
import { THRESHOLDS } from "../config/thresholds";

export function killConditions(c: TokenRaw): KillCondition[] {
  const hits: KillCondition[] = [];
  const rs90 = computeRelativeStrength(c.returnsPct).rsBtc90d;
  const k = THRESHOLDS.kill;

  // 条件一：YTD < 0
  if (c.returnsPct.ytd < 0) hits.push("YTD_NEGATIVE");
  // 条件二：BTC YTD > 该币 YTD（跑输 BTC）
  if (BTC_BENCHMARK.returnsPct.ytd > c.returnsPct.ytd) hits.push("YTD_UNDER_BTC");
  // 条件三：90D 相对强度 < 0
  if (rs90 < 0) hits.push("RS_90D_NEGATIVE");
  // 条件四：成交量连续下降
  if (c.volume.changePct < k.volumeDeclinePct) hits.push("VOLUME_DECLINING");
  // 条件五：Holder Growth < 0
  if (c.holder.d7 < 0) hits.push("HOLDER_DECLINING");
  // 条件六：Smart Money 净流出
  if (c.smartMoney.netflow < 0) hits.push("SM_OUTFLOW");
  // 条件七：无新叙事（新鲜度低）
  if (c.narrative.freshness < 30) hits.push("NO_NEW_NARRATIVE");
  // 条件八：无未来催化剂
  if (catalyst100(c) < k.noCatalystThreshold) hits.push("NO_CATALYST");
  // 条件九：市值下降（以 90D 弱势作代理）
  if (c.returnsPct.d90 < 0) hits.push("MCAP_DECLINING");
  // 条件十：交易活跃度明显下降
  if (c.volume.changePct < k.activityDeclinePct || c.volume.volToMc < 0.01)
    hits.push("ACTIVITY_DECLINING");

  return hits;
}

/** 生成中文删除原因（引用实际指标数值） */
export function buildRemoveReasons(
  c: TokenRaw,
  hits: KillCondition[],
): string[] {
  const rs = computeRelativeStrength(c.returnsPct);
  const out: string[] = [];
  for (const h of hits) {
    switch (h) {
      case "YTD_NEGATIVE":
        out.push(`YTD ${c.returnsPct.ytd.toFixed(0)}%`);
        break;
      case "YTD_UNDER_BTC":
        out.push(
          `跑输 BTC ${(c.returnsPct.ytd - BTC_BENCHMARK.returnsPct.ytd).toFixed(0)}%`,
        );
        break;
      case "RS_90D_NEGATIVE":
        out.push(`RS vs BTC(90D) ${rs.rsBtc90d.toFixed(0)}`);
        break;
      case "VOLUME_DECLINING":
        out.push(`成交量下降 ${Math.abs(c.volume.changePct).toFixed(0)}%`);
        break;
      case "HOLDER_DECLINING":
        out.push(`Holder 增长 ${c.holder.d7.toFixed(1)}%`);
        break;
      case "SM_OUTFLOW":
        out.push(`Smart Money 净流出 ${c.smartMoney.netflow.toFixed(0)}`);
        break;
      case "NO_NEW_NARRATIVE":
        out.push("无新叙事");
        break;
      case "NO_CATALYST":
        out.push("无明确催化剂");
        break;
      case "MCAP_DECLINING":
        out.push(`90D 弱势 ${c.returnsPct.d90.toFixed(0)}%`);
        break;
      case "ACTIVITY_DECLINING":
        out.push("交易活跃度下降");
        break;
    }
  }
  return out;
}