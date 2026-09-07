// =============================================================
// Mock / Demo 数据生成器
// 在无真实 API Key 时使用，生成 1000+ 个币的「内部一致」的原始指标。
// 所有数据均标记为 Demo，绝不伪装成实时行情。
// =============================================================
import type {
  TokenRaw,
  NarrativeTag,
  CatalystEvent,
  CatalystType,
} from "../types";
import {
  mulberry32,
  randRange,
  randGaussian,
  randLogRange,
  pick,
  chance,
  type Rng,
} from "./seededRandom";

/** BTC 基准涨跌幅（用于相对强度计算） */
export const BTC_BENCHMARK = {
  returnsPct: { d1: 0.6, d7: 3.4, d30: 8.6, d90: 13.2, ytd: 31.5 },
};

export const TOTAL_COINS = 1050;

// 线性插值
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 由强度 t∈[0,1] 映射到 [lo,hi] 并叠加高斯噪声
function mapS(rng: Rng, t: number, lo: number, hi: number, noise = 0.2): number {
  const v = lerp(lo, hi, t);
  return v + randGaussian(rng, 0, Math.abs(hi - lo) * noise);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// 催化事件池
const CATALYST_POOL: { type: CatalystType; label: string }[] = [
  { type: "CEX_LISTING", label: "Binance 现货上线" },
  { type: "CEX_LISTING", label: "Coinbase 上线" },
  { type: "FUTURES", label: "上线永续合约" },
  { type: "SPOT", label: "现货交易对开放" },
  { type: "ETF", label: "ETF 申请" },
  { type: "MAINNET", label: "主网上线" },
  { type: "UNLOCK", label: "代币解锁" },
  { type: "PRODUCT", label: "V2 产品上线" },
  { type: "UPGRADE", label: "协议升级" },
  { type: "PARTNERSHIP", label: "重大合作" },
  { type: "ECOSYSTEM", label: "新生态基金启动" },
  { type: "INSTITUTION", label: "机构入场" },
];

// 叙事标签池（加权）
const NARRATIVE_POOL: NarrativeTag[] = [
  "AI", "AI", "AI_AGENT", "DeFi", "Meme", "Meme", "Meme", "DePIN", "RWA",
  "L1", "L2", "DEX", "Perp", "Tokenization", "Stablecoin", "SOL_ECO",
  "ETH_ECO", "BTC_ECO", "Robinhood", "Other",
];

// 生成随机币名
const NAME_PREFIX = [
  "Neo", "Hyper", "Alpha", "Nova", "Quantum", "Cyber", "Meta", "Ultra",
  "Proto", "Aero", "Nano", "Orb", "Luna", "Astro", "Nebula", "Volt", "Zen",
  "Onyx", "Pixel", "Echo", "Flux", "Glow", "Halo", "Ion", "Kite", "Leaf",
  "Mint", "Nest", "Oak", "Pine", "Rift", "Sage", "Tide", "Umbra", "Vale",
  "Wisp", "Hex", "Zinc", "Vega", "Terra", "Cinder", "Prism", "Axiom", "Brisk",
] as const;
const NAME_SUFFIX = [
  "Chain", "Protocol", "Labs", "Network", "Swap", "Dex", "Fi", "Token",
  "Coin", "Dao", "Verse", "Node", "Link", "Base", "Core", "Hub", "One",
  "Max", "Pay", "GPT", "Eco", "Kit", "Grid", "Flow", "Byte",
] as const;

function randomSymbol(rng: Rng, used: Set<string>): string {
  for (let i = 0; i < 1000; i++) {
    const sym = (pick(rng, NAME_PREFIX) + pick(rng, NAME_SUFFIX)).toUpperCase();
    if (!used.has(sym)) return sym;
  }
  return "TOKEN" + Math.floor(rng() * 1e6);
}

type Archetype = "star" | "strong" | "watch" | "recovery" | "weak";

interface KnownMeta {
  symbol: string;
  name: string;
  chain: string;
  isMeme?: boolean;
  isRobinhood?: boolean;
  tags: NarrativeTag[];
  strength: number;
  archetype?: Archetype;
  mc?: number; // market cap 近似值
}

// 知名币种（含强弱两级，用于演示 S/C 分级，SHIB 故意设为弱势 → C 删除）
const KNOWN: KnownMeta[] = [
  { symbol: "BTC", name: "Bitcoin", chain: "Bitcoin", tags: ["BTC_ECO"], strength: 0.9, mc: 1.18e12 },
  { symbol: "ETH", name: "Ethereum", chain: "Ethereum", tags: ["ETH_ECO", "Tokenization"], strength: 0.87, mc: 3.9e11 },
  { symbol: "SOL", name: "Solana", chain: "Solana", tags: ["SOL_ECO", "L1"], strength: 0.93, mc: 8.4e10 },
  { symbol: "BNB", name: "BNB", chain: "BNB Chain", tags: ["L1"], strength: 0.8, mc: 8.2e10 },
  { symbol: "XRP", name: "XRP", chain: "XRP Ledger", tags: ["Other"], strength: 0.78, mc: 1.1e11 },
  { symbol: "TAO", name: "Bittensor", chain: "Subtensor", tags: ["AI"], strength: 0.95, mc: 3.4e9 },
  { symbol: "FET", name: "Fetch.ai", chain: "Cosmos", tags: ["AI", "AI_AGENT"], strength: 0.88, mc: 2.1e9 },
  { symbol: "RNDR", name: "Render", chain: "Solana", tags: ["AI", "DePIN"], strength: 0.9, mc: 3.8e9 },
  { symbol: "INJ", name: "Injective", chain: "Cosmos", tags: ["L1", "DeFi", "AI"], strength: 0.85, mc: 2.6e9 },
  { symbol: "PENDLE", name: "Pendle", chain: "Ethereum", tags: ["DeFi", "RWA"], strength: 0.82, mc: 7.5e8 },
  { symbol: "ONDO", name: "Ondo", chain: "Ethereum", tags: ["RWA", "Tokenization"], strength: 0.86, mc: 9.6e8 },
  { symbol: "ENA", name: "Ethena", chain: "Ethereum", tags: ["Stablecoin", "DeFi"], strength: 0.72, mc: 6.4e8 },
  { symbol: "JUP", name: "Jupiter", chain: "Solana", tags: ["DEX", "SOL_ECO"], strength: 0.75, mc: 1.1e9 },
  { symbol: "WIF", name: "dogwifhat", chain: "Solana", tags: ["Meme"], isMeme: true, strength: 0.7, mc: 2.8e9 },
  { symbol: "PEPE", name: "Pepe", chain: "Ethereum", tags: ["Meme"], isMeme: true, strength: 0.63, mc: 4.6e9 },
  { symbol: "BONK", name: "Bonk", chain: "Solana", tags: ["Meme"], isMeme: true, strength: 0.58, mc: 1.2e9 },
  { symbol: "TRUMP", name: "Official Trump", chain: "Solana", tags: ["Meme"], isMeme: true, strength: 0.4, mc: 9e8 },
  { symbol: "SHIB", name: "Shiba Inu", chain: "Ethereum", tags: ["Meme"], isMeme: true, strength: 0.34, mc: 1.1e10 },
  { symbol: "DOGE", name: "Dogecoin", chain: "Dogecoin", tags: ["Meme"], isMeme: true, strength: 0.5, mc: 2.2e10 },
  { symbol: "LINK", name: "Chainlink", chain: "Ethereum", tags: ["RWA", "DeFi"], strength: 0.77, mc: 1.6e10 },
  { symbol: "AAVE", name: "Aave", chain: "Ethereum", tags: ["DeFi", "Stablecoin"], strength: 0.74, mc: 3.6e9 },
  { symbol: "LDO", name: "Lido DAO", chain: "Ethereum", tags: ["ETH_ECO", "DeFi"], strength: 0.62, mc: 1.8e9 },
  { symbol: "ARB", name: "Arbitrum", chain: "Arbitrum", tags: ["L2", "ETH_ECO"], strength: 0.68, mc: 2.4e9 },
  { symbol: "OP", name: "Optimism", chain: "Optimism", tags: ["L2", "ETH_ECO"], strength: 0.66, mc: 2.1e9 },
  { symbol: "SUI", name: "Sui", chain: "Sui", tags: ["L1"], strength: 0.84, mc: 1.2e10 },
  { symbol: "APT", name: "Aptos", chain: "Aptos", tags: ["L1"], strength: 0.7, mc: 3.5e9 },
  { symbol: "SEI", name: "Sei", chain: "Sei", tags: ["L1"], strength: 0.82, mc: 1.9e9 },
  { symbol: "TIA", name: "Celestia", chain: "Cosmos", tags: ["Other"], strength: 0.55, mc: 9e8 },
  { symbol: "ATOM", name: "Cosmos", chain: "Cosmos", tags: ["L1"], strength: 0.52, mc: 2.7e9 },
  { symbol: "NEAR", name: "NEAR Protocol", chain: "NEAR", tags: ["L1", "AI"], strength: 0.83, mc: 5.4e9 },
  { symbol: "IMX", name: "Immutable", chain: "Ethereum", tags: ["Other"], strength: 0.48, mc: 2e9 },
  { symbol: "GRT", name: "The Graph", chain: "Ethereum", tags: ["AI", "DePIN"], strength: 0.6, mc: 2.2e9 },
  { symbol: "STX", name: "Stacks", chain: "Bitcoin", tags: ["BTC_ECO"], strength: 0.71, mc: 2.9e9 },
  { symbol: "ORDI", name: "ORDI", chain: "Bitcoin", tags: ["BTC_ECO"], strength: 0.44, mc: 5e8 },
  { symbol: "RUNE", name: "THORChain", chain: "Cosmos", tags: ["DeFi"], strength: 0.57, mc: 1.3e9 },
  { symbol: "PYTH", name: "Pyth Network", chain: "Solana", tags: ["SOL_ECO", "RWA"], strength: 0.76, mc: 1.3e9 },
  { symbol: "ETHFI", name: "Ether.fi", chain: "Ethereum", tags: ["ETH_ECO", "DeFi"], strength: 0.6, mc: 4e8 },
  { symbol: "DYDX", name: "dYdX", chain: "Cosmos", tags: ["Perp", "DEX"], strength: 0.61, mc: 8e8 },
  { symbol: "GMX", name: "GMX", chain: "Arbitrum", tags: ["Perp", "DeFi"], strength: 0.54, mc: 3e8 },
  { symbol: "MKR", name: "Maker", chain: "Ethereum", tags: ["Stablecoin", "DeFi", "RWA"], strength: 0.73, mc: 2.5e9 },
];

// 根据 archetype 决定强度与最近动量，保证指标内部一致
function resolveStrength(rng: Rng, a: Archetype, base?: number): { s: number; r: number } {
  switch (a) {
    case "star":
      return { s: clamp(randRange(rng, 0.84, 0.99), 0, 1), r: randRange(rng, 0.7, 1) };
    case "strong":
      return { s: clamp(randRange(rng, 0.7, 0.84), 0, 1), r: randRange(rng, 0.45, 0.85) };
    case "watch":
      return { s: clamp(randRange(rng, 0.52, 0.68), 0, 1), r: randRange(rng, 0.2, 0.6) };
    case "recovery":
      // 长期弱（YTD 为负）但最近动量强
      return { s: clamp(randRange(rng, 0.25, 0.42), 0, 1), r: randRange(rng, 0.7, 0.95) };
    case "weak":
      return { s: clamp(randRange(rng, 0.05, 0.42), 0, 1), r: randRange(rng, -1, 0.15) };
    default:
      return { s: base ?? 0.5, r: randRange(rng, -0.5, 0.5) };
  }
}

function pickArchetype(rng: Rng): Archetype {
  const x = rng();
  if (x < 0.025) return "star"; // ~2.5%
  if (x < 0.06) return "strong"; // ~3.5%
  if (x < 0.12) return "watch"; // ~6%
  if (x < 0.15) return "recovery"; // ~3%
  return "weak"; // ~85%
}

// 生成单个币的原始指标
function buildRaw(
  rng: Rng,
  meta: { symbol: string; name: string; chain: string; isMeme: boolean; isRobinhood: boolean; tags: NarrativeTag[]; s: number; r: number; mc: number },
): TokenRaw {
  const { symbol, name, chain, isMeme, isRobinhood, tags, s, r, mc } = meta;

  // 长期收益取决于长期强度；短期收益取决于最近动量
  const ytd = mapS(rng, s, -82, 260, 0.28);
  const d90 = mapS(rng, s, -62, 150, 0.3);
  const d30 = mapS(rng, normR(r), -48, 85, 0.35);
  const d7 = mapS(rng, normR(r), -24, 55, 0.4);
  const d1 = mapS(rng, normR(r), -13, 20, 0.45);

  const volToMc = clamp(randLogRange(rng, 0.004, 0.6), 0.001, 2);
  const volume24h = mc * volToMc;
  const volChangePct = mapS(rng, normR(r), -72, 240, 0.38);

  // 上市天数：新 Meme 上市短，老牌大币上市久
  const listedDays =
    isMeme && s > 0.6
      ? Math.round(randRange(rng, 5, 120))
      : Math.round(randRange(rng, 30, 4000));

  const ma20 = mapS(rng, normR(r), -30, 10, 0.4);
  const ma50 = mapS(rng, normR(r), -48, 22, 0.4);
  const ma200 = mapS(rng, s, -72, 58, 0.35);

  // rb = 最近动量归一化；资金/叙事/催化等“当下状态”应跟随 rb，
  // 而长期指标（YTD / 90D）跟随 s，从而让“反转观察区(recovery)”币
  // 呈现「长期弱、近期强」的内部一致性。
  const rb = normR(r);

  const holderD7 = mapS(rng, rb, -20, 38, 0.4);
  const holderH24 = holderD7 / 3 + randGaussian(rng, 0, 1.2);
  const smartNetflow = mapS(rng, rb, -92, 92, 0.26);
  const buySellRatio = clamp(lerp(0.3, 3.8, rb) * Math.exp(randGaussian(rng, 0, 0.3)), 0.05, 12);

  const freshness = mapS(rng, rb, 4, 96, 0.18);
  const narrativeTrend = mapS(rng, r, -65, 85, 0.32);

  const attBase = clamp(lerp(10, 95, Math.max(s, rb)) + randGaussian(rng, 0, 14), 0, 100);
  const attGrowth = mapS(rng, rb, -55, 130, 0.4);

  const qBase = mapS(rng, Math.max(s, rb), 0, 96, 0.22);
  const q7 = clamp(qBase + randGaussian(rng, 0, 8), 0, 100);
  const q30 = clamp(qBase + randGaussian(rng, 0, 10), 0, 100);
  const q90 = clamp(qBase + randGaussian(rng, 0, 12), 0, 100);

  // 催化事件：强币有事件，弱币无
  const events: CatalystEvent[] = [];
  if (s > 0.72) {
    const n = chance(rng, 0.8) ? Math.floor(randRange(rng, 1, 3)) : 0;
    for (let i = 0; i < n; i++) {
      const e = pick(rng, CATALYST_POOL);
      const horizon = (pick(rng, [7, 30, 90] as const));
      events.push({ type: e.type, label: e.label, horizon });
    }
  }

  return {
    id: symbol.toLowerCase(),
    symbol,
    name,
    chain,
    listedDays,
    isMeme,
    isRobinhood,
    price: randLogRange(rng, 0.0002, 80000),
    marketCap: mc,
    fdv: mc * randRange(rng, 1.1, 3.2),
    volume24h,
    returnsPct: { d1, d7, d30, d90, ytd },
    maDeltaPct: { ma20, ma50, ma200 },
    volume: {
      avg7d: volume24h / (1 + volChangePct / 100 / 1.6),
      avg30d: volume24h / (1 + volChangePct / 100),
      changePct: volChangePct,
      volToMc,
      depth: clamp(mapS(rng, s, 6, 98, 0.12), 0, 100),
    },
    holder: {
      h1: holderH24 / 8 + randGaussian(rng, 0, 0.2),
      h6: holderH24 / 3 + randGaussian(rng, 0, 0.4),
      h24: holderH24,
      d7: holderD7,
    },
    smartMoney: {
      netflow: smartNetflow,
      walletCount: Math.max(0, Math.round(mapS(rng, rb, 0, 420, 0.3))),
      buySellRatio,
      newWallets: Math.max(0, Math.round(mapS(rng, rb, -10, 180, 0.35))),
      positionChangePct: mapS(rng, rb, -42, 64, 0.3),
    },
    narrative: {
      tags,
      freshness: clamp(freshness, 0, 100),
      trend: clamp(narrativeTrend, -100, 100),
    },
    attention: {
      base: clamp(attBase, 0, 100),
      growthPct: attGrowth,
      sources: {
        x: clamp(attBase + randGaussian(rng, 0, 12), 0, 100),
        google: clamp(attBase + randGaussian(rng, 0, 14), 0, 100),
        social: clamp(attBase + randGaussian(rng, 0, 10), 0, 100),
        community: clamp(attBase + randGaussian(rng, 0, 16), 0, 100),
        news: clamp(attBase + randGaussian(rng, 0, 18), 0, 100),
        exchange: clamp(attBase + randGaussian(rng, 0, 18), 0, 100),
      },
    },
    catalyst: { q7, q30, q90, events },
    meme: isMeme
      ? {
          bundledWalletsPct: clamp(mapS(rng, 1 - s, 2, 45, 0.3), 0, 100),
          devHoldingPct: clamp(randRange(rng, 1, 40), 0, 100),
          devSellingPct: clamp(mapS(rng, 1 - s, 0, 35, 0.4), 0, 100),
          top10ConcentrationPct: clamp(randRange(rng, 5, 80), 0, 100),
          lpSize: randLogRange(rng, 1e4, 5e7),
          lpChangePct: mapS(rng, normR(r), -40, 120, 0.4),
          sniperPct: clamp(randRange(rng, 0, 35), 0, 100),
          freshWalletPct: clamp(mapS(rng, normR(r), 5, 70, 0.3), 0, 100),
          socialAcceleration: mapS(rng, normR(r), -70, 90, 0.4),
          xMentions: Math.round(mapS(rng, normR(r), 0, 25000, 0.5)),
        }
      : undefined,
    addedToday: chance(rng, s > 0.6 ? 0.5 : 0.03),
    removedToday: chance(rng, s < 0.35 ? 0.4 : 0.02),
  };
}

function normR(r: number): number {
  return clamp((r + 1) / 2, 0, 1);
}

/** 生成全部 Mock 币（知名币 + 随机币） */
export function generateMockTokens(): TokenRaw[] {
  const rng = mulberry32(20260907);
  const used = new Set<string>();
  const coins: TokenRaw[] = [];

  const push = (t: TokenRaw) => {
    used.add(t.symbol);
    coins.push(t);
  };

  // 1) 知名币
  for (const k of KNOWN) {
    const a: Archetype = k.archetype ?? (k.strength >= 0.84 ? "star" : k.strength >= 0.7 ? "strong" : k.strength >= 0.5 ? "watch" : "weak");
    const { s, r } = resolveStrength(rng, a, k.strength);
    push(
      buildRaw(rng, {
        symbol: k.symbol,
        name: k.name,
        chain: k.chain,
        isMeme: !!k.isMeme,
        isRobinhood: !!k.isRobinhood,
        tags: k.tags,
        s,
        r,
        mc: k.mc ?? randLogRange(rng, 1e7, 4e10),
      }),
    );
  }

  // 2) 其余币由 archetype 分布生成
  while (coins.length < TOTAL_COINS) {
    const a = pickArchetype(rng);
    const { s, r } = resolveStrength(rng, a);
    const symbol = randomSymbol(rng, used);
    used.add(symbol);
    const name = symbol.replace(/([A-Z])/g, " $1").trim();
    const isMeme = chance(rng, 0.22);
    const isRobinhood = chance(rng, a === "star" || a === "strong" ? 0.25 : 0.07);
    const nTags = Math.max(0, Math.floor(randRange(rng, 0, 3.4)));
    const tagSet = new Set<NarrativeTag>();
    for (let i = 0; i < nTags; i++) tagSet.add(pick(rng, NARRATIVE_POOL));
    if (isMeme) tagSet.add("Meme");
    if (isRobinhood) tagSet.add("Robinhood");
    const tags = Array.from(tagSet).slice(0, 3);

    const mc = randLogRange(rng, 3e5, 6e11);
    coins.push(
      buildRaw(rng, {
        symbol,
        name,
        chain: pick(rng, ["Ethereum", "Solana", "Base", "BNB Chain", "Arbitrum", "Sui", "Aptos", "Cosmos", "Bitcoin"]),
        isMeme,
        isRobinhood,
        tags,
        s,
        r,
        mc,
      }),
    );
  }

  return coins;
}