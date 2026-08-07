export type Direction = "bullish" | "neutral" | "bearish";
export type Importance = "critical" | "high" | "medium" | "low";
export type Sector =
  | "BTC"
  | "ETH"
  | "SOL"
  | "Layer2"
  | "DeFi"
  | "Meme"
  | "AI"
  | "RWA"
  | "Stablecoin"
  | "ETF"
  | "Regulation"
  | "DePIN";

export interface Asset {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  spark: number[];
}

export interface AlphaSignal {
  id: string;
  title: string;
  direction: Direction;
  confidence: number; // 0-100
  strength: number; // 0-100
  category: "kol-resonance" | "onchain-flow" | "sentiment-surge" | "exchange-flow" | "whale-accumulation" | "derivative";
  basis: string;
  assets: string[];
  eventIds: string[];
  kols: string[];
  winRate: number; // %
  avgReturn: number; // %
  risk: string;
  ts: number;
  spark: number[];
}

export interface Event {
  id: string;
  title: string;
  summary: string;
  importance: Importance;
  importanceScore: number; // 0-100
  sentiment: number; // 0-100
  direction: Direction;
  sectors: Sector[];
  assets: string[];
  ts: number;
  reach: number; // people reached
  velocity: number; // propagation velocity
  kolCount: number;
  tweetCount: number;
  status: "developing" | "peaked" | "fading" | "realized";
  aiAnalysis: {
    oneLiner: string;
    background: string;
    bullCase: string;
    bearCase: string;
    outlook: string;
    risk: string;
    watch: string[];
  };
  timeline: { ts: number; label: string; desc: string }[];
  outcome: {
    "1h": number;
    "24h": number;
    "7d": number;
    "30d": number;
    "90d": number;
  };
  kols: string[];
  relatedEvents: string[];
  spark: number[];
}

export interface KOL {
  id: string;
  handle: string;
  name: string;
  avatar: string;
  bio: string;
  followers: number;
  posts: number;
  avgEngagement: number;
  predictions: number;
  hitRate: number; // %
  bullRatio: number; // %
  bearRatio: number; // %
  trustScore: number; // 0-100
  influenceScore: number; // 0-100
  accuracyScore: number; // 0-100
  recentView: string;
  tags: string[];
  spark: number[];
  topCall?: { asset: string; direction: Direction; return: number; ts: number };
}

export interface Sentiment {
  sector: string;
  label: string;
  now: number; // 0-100
  "24h": number;
  "7d": number;
  "30d": number;
  trend: number[];
}

export interface Project {
  id: string;
  name: string;
  symbol: string;
  sector: Sector;
  heat: number; // 0-100
  heatChange: number; // %
  mentions: number;
  kolMentions: number;
  price: number;
  change24h: number;
  spark: number[];
}

export interface FlowRecord {
  asset: string;
  netFlow: number; // USD, negative = outflow
  exchangeInflow: number;
  exchangeOutflow: number;
  whaleNet: number;
  stablecoinSupply: number;
  change: number;
}

export interface PropagationNode {
  id: string;
  label: string;
  group: "origin" | "amplifier" | "spread" | "global";
  value: number;
  lang: "zh" | "en";
}
export interface PropagationLink {
  source: string;
  target: string;
  value: number;
}

export interface TickerItem {
  symbol: string;
  price: number;
  change: number;
}
