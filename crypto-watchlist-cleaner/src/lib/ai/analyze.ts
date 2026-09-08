// =============================================================
// AI 分析层 —— 市场智能预警 + 币种深度分析（真实 LLM）
// 依赖 client.ts（OpenAI 兼容端点）。
// 未配置 VITE_AI_API_URL 时 isAiConfigured()=false，本层静默降级：
//   - generateAiAlerts 返回 []
//   - analyzeCoin 返回 ""
// 任何网络/解析异常都被吞掉，绝不抛给主流程。
// =============================================================
import type { Alert, MarketSnapshot, ScoredCoin } from "../types";
import { isAiConfigured, chatJson, chatCompletion } from "./client";
import { fmtCompact } from "../utils/format";

const ALERT_LEVELS: Alert["level"][] = ["critical", "warn", "info", "recovery"];

interface AiAlertItem {
  symbol?: unknown;
  level?: unknown;
  message?: unknown;
}

/** 将模型输出的 level 文本归一化到 Alert 四档 */
function toLevel(v: unknown): Alert["level"] {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("critical") || s.includes("danger") || s.includes("删除"))
    return "critical";
  if (s.includes("recovery") || s.includes("反转") || s.includes("回升"))
    return "recovery";
  if (s.includes("warn") || s.includes("警告")) return "warn";
  return "info";
}

const ALERT_SYSTEM = [
  "你是加密货币市场智能预警引擎。",
  "请基于我提供的市场快照和 Top 币种指标，找出当前最值得警惕的信号。",
  "最多输出 6 条预警，优先覆盖：删除信号(critical)、反转回升(recovery)、资金异动(warn)、动量异动(info)。",
  "每条预警必须引用具体指标数值（如涨跌幅、成交量变化、Holder 增长、Smart Money 净流），不要凭空判断。",
  "仅输出 JSON 数组，不要 markdown、不要解释，格式如下：",
  '[{"symbol":"BTC","level":"critical","message":"中文预警说明，引用具体指标"}]',
].join("\n");

/** 市场快照 + Top 币种 → 供 LLM 阅读的紧凑文本 */
function snapshotText(snapshot: MarketSnapshot, top: ScoredCoin[]): string {
  const head = [
    `市场快照：`,
    `币种总数 ${snapshot.totalCoins}`,
    `风险分 ${snapshot.riskScore}/100`,
    `上涨广度 ${snapshot.marketBreadth}%`,
    `BTC 趋势 ${snapshot.btcTrend}`,
    `ETH 趋势 ${snapshot.ethTrend}`,
    `总市值 ${fmtCompact(snapshot.totalMarketCap)}`,
    `BTC 占比 ${snapshot.btcDominance.toFixed(1)}%`,
    `数据源 ${snapshot.dataSource}${snapshot.isDemo ? "（Demo）" : ""}`,
    "",
  ].join("\n");

  const lines = top.map((c) =>
    [
      `${c.symbol}(${c.name})`,
      `排名${c.rank}`,
      `评分${c.finalScore.toFixed(0)}/${c.grade}`,
      `24H${c.returnsPct.d1.toFixed(1)}%`,
      `7D${c.returnsPct.d7.toFixed(1)}%`,
      `30D${c.returnsPct.d30.toFixed(1)}%`,
      `市值${fmtCompact(c.marketCap)}`,
      `成交额${fmtCompact(c.volume24h)}`,
      `量变${c.volume.changePct.toFixed(0)}%`,
      `Holder7D${c.holder.d7.toFixed(1)}%`,
      `SM净流${c.smartMoney.netflow.toFixed(0)}`,
      `叙事[${c.narrative.tags.join("/")}]`,
      c.isRecovery ? "反转" : "",
      c.strongC ? "StrongC" : "",
    ]
      .filter(Boolean)
      .join("  "),
  );

  return head + "\n" + lines.join("\n");
}

/**
 * 生成市场级 AI 预警。失败或未配置时返回 []（规则预警不受影响）。
 */
export async function generateAiAlerts(
  snapshot: MarketSnapshot,
  coins: ScoredCoin[],
): Promise<Alert[]> {
  if (!isAiConfigured() || coins.length === 0) return [];
  const top = coins.slice(0, 25);
  try {
    const raw = await chatJson<AiAlertItem[] | { alerts?: AiAlertItem[] }>({
      system: ALERT_SYSTEM,
      user: snapshotText(snapshot, top),
      temperature: 0.3,
      maxTokens: 700,
    });
    const items = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { alerts?: AiAlertItem[] })?.alerts)
        ? (raw as { alerts: AiAlertItem[] }).alerts
        : [];

    const bySymbol = new Map(top.map((c) => [c.symbol.toUpperCase(), c]));
    const time = new Date().toISOString();
    const out: Alert[] = [];

    for (const it of items) {
      const symbol = String(it?.symbol ?? "").toUpperCase();
      const message = String(it?.message ?? "").trim();
      if (!symbol || !message) continue;
      if (out.length >= 6) break;
      const hit = bySymbol.get(symbol);
      out.push({
        id: `ai-${time}-${out.length}`,
        symbol,
        name: hit?.name ?? symbol,
        level: toLevel(it?.level),
        message,
        time,
        ai: true,
      });
    }
    // 保证返回的 level 均为合法值
    return out.filter((a) => ALERT_LEVELS.includes(a.level));
  } catch {
    return [];
  }
}

const COIN_SYSTEM = [
  "你是加密货币研究员。",
  "基于给定币种的全部量化指标，用中文给出 3-5 句结论性深度分析，覆盖：",
  "趋势与相对强度、资金与筹码（Holder/Smart Money/成交量）、叙事与催化剂、最大风险、是否值得自选。",
  "必须引用实际指标数值，不要编造数据；语气客观克制，直接给结论，不要客套话。",
].join("\n");

/** 单个币种 → 供 LLM 阅读的紧凑指标文本 */
function coinText(c: ScoredCoin): string {
  const parts = [
    `${c.symbol}(${c.name}) 链:${c.chain} 上市${c.listedDays}天`,
    `排名${c.rank} 评分${c.finalScore.toFixed(0)}/100 分级${c.grade} 建议${c.recommendation}`,
    `价格 ${c.price} 市值${fmtCompact(c.marketCap)} FDV${fmtCompact(c.fdv)}`,
    `涨跌 24H${c.returnsPct.d1.toFixed(1)}% 7D${c.returnsPct.d7.toFixed(1)}% 30D${c.returnsPct.d30.toFixed(1)}% 90D${c.returnsPct.d90.toFixed(1)}% YTD${c.returnsPct.ytd.toFixed(1)}%`,
    `相对BTC ${c.rsBtc.toFixed(1)}% 90D${c.rsBtc90d.toFixed(1)}% 趋势${c.trend} 资金${c.moneyFlow}`,
    `成交额${fmtCompact(c.volume24h)} 量变${c.volume.changePct.toFixed(0)}% 换手${(c.volume.volToMc * 100).toFixed(1)}%`,
    `Holder 1H${c.holder.h1.toFixed(1)}% 6H${c.holder.h6.toFixed(1)}% 24H${c.holder.h24.toFixed(1)}% 7D${c.holder.d7.toFixed(1)}%`,
    `SmartMoney 净流${c.smartMoney.netflow.toFixed(0)} 钱包${c.smartMoney.walletCount} 买卖比${c.smartMoney.buySellRatio.toFixed(2)} 新增${c.smartMoney.newWallets}`,
    `叙事[${c.narrative.tags.join("/")}] 新鲜度${c.narrative.freshness.toFixed(0)}`,
    `催化 q7=${c.catalyst.q7} q30=${c.catalyst.q30} q90=${c.catalyst.q90} 事件${c.catalyst.events.map((e) => e.label).join("、") || "无"}`,
    `触发Kill条件 ${c.killCount} 项 ${c.killHits.join("、") || "无"}`,
    c.isRecovery ? "已进入反转区" : "",
    c.isSCandidate ? "S级候选" : "",
    c.strongC ? "StrongC 删除信号" : "",
  ];
  if (c.meme) {
    parts.push(
      `Meme 捆绑${c.meme.bundledWalletsPct.toFixed(0)}% 开发者持仓${c.meme.devHoldingPct.toFixed(0)}% 开发者抛售${c.meme.devSellingPct.toFixed(0)}% Top10集中${c.meme.top10ConcentrationPct.toFixed(0)}% LP${fmtCompact(c.meme.lpSize)} 狙击${c.meme.sniperPct.toFixed(0)}%`,
    );
  }
  const s = c.summary;
  parts.push(`强势理由：${s.whyStrong.join("；")}`);
  parts.push(`弱势理由：${s.whyWeak.join("；")}`);
  return parts.filter(Boolean).join("\n");
}

/**
 * 生成单个币种的深度分析（纯文本）。失败/未配置时返回空字符串。
 */
export async function analyzeCoin(coin: ScoredCoin): Promise<string> {
  if (!isAiConfigured()) return "";
  try {
    return await chatCompletion({
      system: COIN_SYSTEM,
      user: coinText(coin),
      temperature: 0.4,
      maxTokens: 600,
    });
  } catch {
    return "";
  }
}