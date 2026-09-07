// =============================================================
// 市场数据编排：加载原始数据 → 评分 → 构建快照与预警
// =============================================================
import { loadRawTokens } from "./providers";
import { scoreAll } from "../scoring";
import { clamp, round } from "../scoring/helpers";
import type { ScoredCoin, MarketSnapshot, Alert, Grade } from "../types";

export interface MarketData {
  coins: ScoredCoin[];
  snapshot: MarketSnapshot;
  alerts: Alert[];
}

/** 市场整体快照 */
function buildSnapshot(
  coins: ScoredCoin[],
  isDemo: boolean,
  dataSource: string,
  updatedAt: string,
): MarketSnapshot {
  const total = coins.length;
  const gradeCounts: Record<Grade, number> = { S: 0, A: 0, B: 0, C: 0 };
  let up = 0;
  let totalMc = 0;
  let btcMc = 0;
  let btcTrend: MarketSnapshot["btcTrend"] = "Neutral";
  let ethTrend: MarketSnapshot["ethTrend"] = "Neutral";

  for (const c of coins) {
    gradeCounts[c.grade]++;
    if (c.trend === "StrongUp" || c.trend === "Up") up++;
    totalMc += c.marketCap;
    if (c.symbol === "BTC") {
      btcMc = c.marketCap;
      btcTrend = c.trend;
    }
    if (c.symbol === "ETH") ethTrend = c.trend;
  }

  const breadth = total > 0 ? (up / total) * 100 : 50;
  // 风险分数：广度越低、C 级越多 → 风险越高
  const cRatio = total > 0 ? gradeCounts.C / total : 0;
  const riskScore = round(clamp(100 - breadth + cRatio * 60, 0, 100), 0);

  return {
    totalCoins: total,
    gradeCounts,
    addedToday: coins.filter((c) => c.addedToday).length,
    removedToday: coins.filter((c) => c.removedToday).length,
    riskScore,
    btcTrend,
    ethTrend,
    totalMarketCap: totalMc,
    btcDominance: totalMc > 0 ? (btcMc / totalMc) * 100 : 50,
    marketBreadth: round(breadth, 1),
    dataUpdatedAt: updatedAt,
    isDemo,
    dataSource,
  };
}

/** 由当前状态生成预警（体积/持有人/资金/叙事/反转/删除） */
function buildAlerts(coins: ScoredCoin[]): Alert[] {
  const alerts: Alert[] = [];
  const time = new Date().toISOString();
  let i = 0;

  const strong = coins.filter((c) => c.rank <= 100);
  for (const c of strong) {
    if (alerts.length >= 30) break;
    if (c.volume.changePct > 150) {
      alerts.push({
        id: `a${i++}`,
        symbol: c.symbol,
        name: c.name,
        level: "info",
        message: `24H 成交量 ${c.volume.changePct.toFixed(0)}%`,
        time,
      });
    }
    if (c.holder.d7 > 20) {
      alerts.push({
        id: `a${i++}`,
        symbol: c.symbol,
        name: c.name,
        level: "info",
        message: `Holder 增长 ${c.holder.d7.toFixed(1)}%`,
        time,
      });
    }
    if (c.smartMoney.netflow > 0 && c.smartMoney.netflow <= 15) {
      alerts.push({
        id: `a${i++}`,
        symbol: c.symbol,
        name: c.name,
        level: "info",
        message: "Smart Money 净流由负转正",
        time,
      });
    }
    if (c.isRecovery) {
      alerts.push({
        id: `a${i++}`,
        symbol: c.symbol,
        name: c.name,
        level: "recovery",
        message: "进入 Recovery Zone（由弱转强）",
        time,
      });
    }
    if (c.strongC) {
      alerts.push({
        id: `a${i++}`,
        symbol: c.symbol,
        name: c.name,
        level: "critical",
        message: `触发删除信号（${c.killCount} 项弱势）`,
        time,
      });
    }
  }

  // 按级别排序：critical > recovery > warn > info
  const order: Record<Alert["level"], number> = {
    critical: 0,
    recovery: 1,
    warn: 2,
    info: 3,
  };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  return alerts;
}

export async function loadMarketData(): Promise<MarketData> {
  const { tokens, isDemo, dataSource, updatedAt } = await loadRawTokens();
  const coins = scoreAll(tokens);
  const snapshot = buildSnapshot(coins, isDemo, dataSource, updatedAt);
  const alerts = buildAlerts(coins);
  return { coins, snapshot, alerts };
}