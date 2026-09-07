// =============================================================
// DexScreener Provider —— 链上 DEX / Meme Radar 数据源（免费、无需 Key）
//
// 数据来源：DexScreener 公共 API（https://api.dexscreener.com）
//   - 发现池：token-boosts/top（付费推广，热点雷达）+ token-profiles/latest（认证项目）
//   - 行情池：latest/dex/tokens/{addr}（每个 token 流动性最高的主交易对）
//
// 能获取的真实链上字段：
//   - price / marketCap / fdv / volume24h / liquidity(LP) / pairCreatedAt(上市天数)
//   - txns（1h/6h/24h 买卖笔数）→ Smart Money 的「买卖比 / 净买入占比」真实代理
//   - priceChange（1h/6h/24h 涨跌幅）
//
// DexScreener 无法提供（诚实置中性/0，不做伪装）：
//   - Holder 数量与增长（需 Birdeye / 链上索引器）
//   - 钱包级 Smart Money 净流入 / 持仓变化（需 GMGN / Nansen）
//   - 捆绑钱包 / 狙击手 / 开发者抛售 / Top10 集中度（需 GMGN / Birdeye，属第三阶段可选增强）
// =============================================================
import type { TokenRaw } from "../../types";
import { ProviderError, type TokenProvider } from "./types";
import { apiGetJson, mapLimit } from "./fetch";

const DEX_BASE =
  (import.meta.env.VITE_DEXSCREENER_API_URL as string | undefined) ||
  "https://api.dexscreener.com";
const MAX_COINS = 60; // 候选池上限（发现接口 60 rpm，控制请求量）
const PARALLEL = 6; // 交易对查询并发数（300 rpm 档，安全）

// ---- 响应类型（字段全部可选，防御不同版本 / 不同链的缺失）----
interface DexTxns {
  buys?: number;
  sells?: number;
}
interface DexPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string | number;
  txns?: Partial<Record<"m5" | "h1" | "h6" | "h24", DexTxns>>;
  volume?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  priceChange?: Partial<Record<"m5" | "h1" | "h6" | "h24", number>>;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
  labels?: string[];
}
interface DexBoost {
  chainId?: string;
  tokenAddress?: string;
  totalAmount?: number;
  description?: string;
}
interface DexProfile {
  chainId?: string;
  tokenAddress?: string;
}
type DexPairsResponse = DexPair[] | { pairs?: DexPair[] };

/** 安全转数字（兼容字符串 / 数字 / 空） */
function num(v: string | number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** 统一解析 `/latest/dex/*` 返回的 pairs（兼容数组或 { pairs: [] } 两种形态） */
function asPairs(data: DexPairsResponse): DexPair[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.pairs)) return data.pairs;
  return [];
}

const CHAIN_LABELS: Record<string, string> = {
  solana: "Solana",
  ethereum: "Ethereum",
  base: "Base",
  bsc: "BNB Chain",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  avalanche: "Avalanche",
  ton: "TON",
  sui: "Sui",
  tron: "Tron",
};
const chainLabel = (id: string | undefined) =>
  (id && CHAIN_LABELS[id.toLowerCase()]) || id || "DEX";

// 轻量 Meme 识别启发式（仅作标签，非严谨判定）
const MEME_HINTS = [
  "meme", "pepe", "doge", "shib", "bonk", "wif", "floki", "mog", "brett",
  "popcat", "giga", "fart", "inu", "pump", "moon", "dogcoin", "catcoin",
  "goat", "turbo", "sigma", "chill", "based", "cult",
];
function looksMeme(symbol: string, name: string): boolean {
  const s = `${symbol} ${name}`.toLowerCase();
  return MEME_HINTS.some((h) => s.includes(h));
}

/** 由 DexScreener 主交易对组装 TokenRaw（真实链上字段 + 诚实的代理/中性字段） */
function buildDexToken(pair: DexPair): TokenRaw | null {
  const base = pair.baseToken;
  const symbol = (base?.symbol ?? "").toUpperCase();
  const address = base?.address ?? "";
  const name = base?.name || symbol;
  if (!symbol || !address || !pair.chainId) return null;

  const price = num(pair.priceUsd);
  if (!(price > 0)) return null;

  const mc = num(pair.marketCap);
  const fdv = num(pair.fdv) || mc;
  const vol24 = num(pair.volume?.h24);
  const liq = num(pair.liquidity?.usd);
  const change24 = num(pair.priceChange?.h24);

  // 真实成交笔数（买卖比、净买入占比，非钱包级资金流）
  const buys24 = num(pair.txns?.h24?.buys);
  const sells24 = num(pair.txns?.h24?.sells);
  const buys1 = num(pair.txns?.h1?.buys);
  const total = buys24 + sells24;

  const listMs = num(pair.pairCreatedAt);
  const listedDays = listMs > 0 ? Math.max(1, Math.round((Date.now() - listMs) / 86400000)) : 30;

  const isMeme = looksMeme(symbol, name);

  return {
    id: `${pair.chainId}:${address}`,
    symbol,
    name,
    chain: chainLabel(pair.chainId),
    listedDays,
    isMeme,
    isRobinhood: false,

    // ---- 真实行情 ----
    price,
    marketCap: mc,
    fdv,
    volume24h: vol24,
    // DexScreener 无 7d/30d/90d/ytd 历史：仅 24H 为真实，其余诚实置 0
    returnsPct: { d1: change24, d7: 0, d30: 0, d90: 0, ytd: 0 },
    maDeltaPct: { ma20: 0, ma50: 0, ma200: 0 },
    volume: {
      avg7d: vol24, // 无历史，用 24H 近似（诚实代理）
      avg30d: vol24,
      changePct: 0, // 无 30D 基准，置中性
      volToMc: mc > 0 ? vol24 / mc : 0, // 真实换手率
      depth: clamp(10 + Math.log10(liq + 1) * 8, 0, 100), // 流动性深度代理
    },

    // ---- Holder：DexScreener 无持有者数据，置中性 ----
    holder: { h1: 0, h6: 0, h24: 0, d7: 0 },

    // ---- Smart Money 代理（真实成交笔数推导，非钱包级）----
    smartMoney: {
      netflow: total > 0 ? clamp(((buys24 - sells24) / total) * 100, -100, 100) : 0,
      walletCount: 0,
      buySellRatio: sells24 > 0 ? buys24 / sells24 : buys24 > 0 ? 2 : 1,
      newWallets: buys1, // 1H 买入笔数，作为「新增买入」代理（非真实新钱包数）
      positionChangePct: 0,
    },

    // ---- 叙事：识别为 Meme 时打标签；热度用 24H 涨幅代理 ----
    narrative: {
      tags: isMeme ? ["Meme"] : ["Other"],
      freshness: 40, // 当前处于推广热点，新鲜度中等
      trend: clamp(change24, -100, 100),
    },

    // ---- 关注度：由真实成交额与笔数推导 ----
    attention: {
      base: clamp(25 + Math.log10(vol24 + 1) * 7 + Math.min(20, Math.log10(total + 1) * 5), 0, 100),
      growthPct: change24,
      sources: { exchange: clamp(25 + Math.log10(vol24 + 1) * 7, 0, 100) },
    },

    catalyst: { q7: 0, q30: 0, q90: 0, events: [] },

    // ---- Meme 雷达：真实 LP 规模 + 其余钱包级指标需 GMGN/Birdeye，置 0 ----
    meme: {
      bundledWalletsPct: 0,
      devHoldingPct: 0,
      devSellingPct: 0,
      top10ConcentrationPct: 0,
      lpSize: liq,
      lpChangePct: 0,
      sniperPct: 0,
      freshWalletPct: 0,
      socialAcceleration: 0,
      xMentions: 0,
    },
  };
}

export class DexScreenerProvider implements TokenProvider {
  readonly name = "dexscreener";

  async fetchTokens(): Promise<TokenRaw[]> {
    // 1) 发现候选池：Top boosted（付费推广）+ latest profiles（认证项目）
    const [boosts, profiles] = await Promise.all([
      apiGetJson<DexBoost[]>(`${DEX_BASE}/token-boosts/top/v1`).catch(() => [] as DexBoost[]),
      apiGetJson<DexProfile[]>(`${DEX_BASE}/token-profiles/latest/v1`).catch(() => [] as DexProfile[]),
    ]);

    // 2) 按 chainId:address 去重，得到 Meme Radar 候选池
    const seeds = new Map<string, { chain: string; addr: string }>();
    for (const b of Array.isArray(boosts) ? boosts : []) {
      if (b.chainId && b.tokenAddress) seeds.set(`${b.chainId}:${b.tokenAddress}`, { chain: b.chainId, addr: b.tokenAddress });
    }
    for (const p of Array.isArray(profiles) ? profiles : []) {
      if (p.chainId && p.tokenAddress) seeds.set(`${p.chainId}:${p.tokenAddress}`, { chain: p.chainId, addr: p.tokenAddress });
    }
    const seedList = [...seeds.values()].slice(0, MAX_COINS);
    if (seedList.length === 0) {
      throw new ProviderError("DexScreener 未返回任何候选 token", "empty");
    }

    // 3) 并发查询每个 token 的主交易对；单 token 失败不阻塞整体
    const rows = await mapLimit(
      seedList,
      async ({ addr }) => {
        try {
          const data = await apiGetJson<DexPairsResponse>(`${DEX_BASE}/latest/dex/tokens/${addr}`);
          const pairs = asPairs(data);
          if (pairs.length === 0) return null;
          // 取流动性最高的交易对作为主对
          const best = pairs
            .filter((p) => num(p.liquidity?.usd) > 0)
            .sort((a, b) => num(b.liquidity?.usd) - num(a.liquidity?.usd))[0] ?? pairs[0];
          return buildDexToken(best);
        } catch {
          return null;
        }
      },
      PARALLEL,
    );

    const tokens = rows.filter((x): x is TokenRaw => x !== null);
    if (tokens.length === 0) {
      throw new ProviderError("DexScreener 行情均为空", "empty");
    }
    return tokens;
  }
}

// ---- 以下两个数据源仍需 API Key，暂为骨架（未配置时触发回退）----
export class BirdeyeProvider implements TokenProvider {
  readonly name = "birdeye";
  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError("Birdeye 数据源尚未接入", "not_configured");
  }
}

export class GmgnProvider implements TokenProvider {
  readonly name = "gmgn";
  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError("GMGN 数据源尚未接入", "not_configured");
  }
}