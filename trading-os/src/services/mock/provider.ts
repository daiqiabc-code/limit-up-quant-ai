// ============================================================
// Mock Exchange Provider
// 实现 ExchangeProvider 接口。所有数据由确定性引擎生成，
// 并随时间演化，模拟 3~5 秒的实时刷新。
// ============================================================
import type {
  Asset,
  Candle,
  ExchangeAccount,
  MarketRegime,
  Order,
  Position,
  Signal,
  SignalBreakdown,
  SetupStage,
  SetupType,
  TradingSnapshot,
  RiskSnapshot,
  RiskContribution,
  SystemHealth,
  Alert,
  MarketEvent,
  AnalyticsSummary,
  StrategyPerformance,
  ExecutionStats,
  DisciplineDaily,
  RegimeState,
  Trend,
  Action,
  RiskLevel,
} from "@/types";
import type { ExchangeProvider, ProviderConfig } from "@/services/provider";
import { COINS, TIMEFRAME_SECONDS, type CoinMeta } from "./universe";
import { clamp, generateCandles, gaussian, mulberry32, round, sma } from "./rand";

const TREND_STATES: RegimeState[] = [
  "BULL_TREND",
  "BULL_TREND",
  "RANGE",
  "BEAR_TREND",
  "TRANSITION",
  "BULL_TREND",
  "BEAR_TREND",
  "CRASH_RISK",
];

function regimeFromDrift(drift: number, rand: number): RegimeState {
  if (drift > 0.55) return "BULL_TREND";
  if (drift > 0.1) return rand > 0.5 ? "BULL_TREND" : "RANGE";
  if (drift > -0.3) return "RANGE";
  if (drift > -0.6) return rand > 0.5 ? "BEAR_TREND" : "TRANSITION";
  return "BEAR_TREND";
}

function trendFromRegime(state: RegimeState): Trend {
  switch (state) {
    case "BULL_TREND":
      return "BULL";
    case "BEAR_TREND":
      return "BEAR";
    case "RANGE":
      return "RANGE";
    case "TRANSITION":
      return "TRANSITION";
    case "CRASH_RISK":
      return "BEAR";
  }
}

function directionFromDrift(drift: number, rand: number): "UP" | "DOWN" | "FLAT" {
  if (Math.abs(drift) < 0.15) return rand > 0.6 ? "UP" : "DOWN";
  return drift >= 0 ? "UP" : "DOWN";
}

function setupFromState(state: RegimeState, drift: number, rand: number): SetupType {
  if (state === "BULL_TREND") {
    const r = rand;
    if (r < 0.4) return "PULLBACK";
    if (r < 0.7) return "BREAKOUT";
    return "RE_ENTRY";
  }
  if (state === "RANGE") return "RANGE";
  if (state === "BEAR_TREND" || state === "CRASH_RISK") return "NONE";
  return rand > 0.5 ? "BREAKOUT" : "NONE";
}

function actionFromScoreAndState(
  score: number,
  state: RegimeState,
): Action {
  if (state === "CRASH_RISK") return "AVOID";
  if (state === "BEAR_TREND" && score < 55) return "AVOID";
  if (score >= 85 && state === "BULL_TREND") return "LONG";
  if (score >= 70) return "WATCH";
  if (score >= 55) return "WAIT";
  return "AVOID";
}

function buildBreakdown(
  coin: CoinMeta,
  state: RegimeState,
  rand: () => number,
): SignalBreakdown {
  const bullish = state === "BULL_TREND";
  const trendBase = bullish ? 18 : state === "RANGE" ? 14 : 8;
  const trend = clamp(Math.round(trendBase + gaussian(rand, 0, 2)), 0, 20);
  const structure = clamp(Math.round((bullish ? 17 : 12) + gaussian(rand, 0, 2.5)), 0, 20);
  const momentum = clamp(Math.round((bullish ? 16 : 11) + gaussian(rand, 0, 3)), 0, 20);
  const volume = clamp(Math.round(13 + gaussian(rand, 0, 2)), 0, 15);
  const htfAlignment = clamp(Math.round((bullish ? 9 : 6) + gaussian(rand, 0, 1.5)), 0, 10);
  const setup = clamp(Math.round((bullish ? 8 : 5) + gaussian(rand, 0, 1.8)), 0, 10);
  const riskReward = clamp(Math.round((bullish ? 4 : 3) + gaussian(rand, 0, 0.8)), 0, 5);
  return { trend, structure, momentum, volume, htfAlignment, setup, riskReward };
}

function scoreFromBreakdown(b: SignalBreakdown): number {
  return b.trend + b.structure + b.momentum + b.volume + b.htfAlignment + b.setup + b.riskReward;
}

interface CoinEngine {
  meta: CoinMeta;
  price: number;
  rand: () => number;
}

export class MockExchangeProvider implements ExchangeProvider {
  readonly id = "mock";
  readonly displayName = "Mock Data Engine";
  readonly supportsLive = false;
  readonly degraded = "MOCK" as const;
  private engines: CoinEngine[] = [];
  private candlesCache = new Map<string, Candle[]>();
  private seed: number;
  private tick = 0;

  constructor(config: ProviderConfig) {
    this.seed = config.seed ?? 42;
    const symbols = new Set(config.symbols);
    const coins = COINS.filter((c) => symbols.has(c.symbol));
    let s = this.seed;
    // 固定引擎顺序，避免重建导致数据抖动
    for (const meta of coins) {
      const rand = mulberry32(s);
      s += 7919;
      // 预演几步，让初始价格带一点历史
      this.engines.push({ meta, price: meta.basePrice, rand });
      for (let i = 0; i < 60; i++) this.stepPrice(this.engines[this.engines.length - 1]);
    }
  }

  private stepPrice(engine: CoinEngine) {
    const ret =
      (engine.meta.drift / 100 / 86400) * 300 +
      gaussian(engine.rand, 0, engine.meta.volatility * Math.sqrt(300 / 86400));
    engine.price = Math.max(engine.meta.basePrice * 0.1, engine.price * (1 + ret));
  }

  private engineOf(symbol: string): CoinEngine {
    const e = this.engines.find((x) => x.meta.symbol === symbol);
    if (!e) throw new Error(`Unknown symbol ${symbol}`);
    return e;
  }

  private regimeFor(symbol: string): MarketRegime {
    const e = this.engineOf(symbol);
    const state = regimeFromDrift(e.meta.drift, e.rand());
    const adx = clamp(Math.round(18 + Math.abs(e.meta.drift) * 40 + gaussian(e.rand, 0, 4)), 0, 70);
    return {
      symbol,
      state,
      daily: directionFromDrift(e.meta.drift, e.rand()),
      h4: directionFromDrift(e.meta.drift, e.rand()),
      h1: directionFromDrift(e.meta.drift, e.rand()),
      ma80: state === "BULL_TREND" ? "ABOVE" : state === "BEAR_TREND" ? "BELOW" : "ABOVE",
      adx,
      volume: state === "BULL_TREND" ? "EXPANDING" : state === "BEAR_TREND" ? "EXPANDING" : "NORMAL",
      volatility: e.meta.volatility > 0.05 ? "HIGH" : e.meta.volatility > 0.04 ? "NORMAL" : "NORMAL",
      structure: state === "BULL_TREND" ? "HH / HL" : state === "BEAR_TREND" ? "LH / LL" : "Range",
      updatedAt: Date.now(),
    };
  }

  // ----------------------------------------------------------
  // ExchangeProvider 接口实现
  // ----------------------------------------------------------
  async getTicker(symbol: string): Promise<Asset> {
    const e = this.engineOf(symbol);
    return this.assetOf(e);
  }

  async getTickers(symbols: string[]): Promise<Record<string, Asset>> {
    const out: Record<string, Asset> = {};
    for (const s of symbols) out[s] = this.assetOf(this.engineOf(s));
    return out;
  }

  private assetOf(e: CoinEngine): Asset {
    const meta = e.meta;
    const change = clamp(gaussian(e.rand, 0, 1.5) + meta.drift * 0.5, -15, 15);
    const vol = meta.basePrice * 1000 * (0.5 + e.rand() * 1.5);
    return {
      symbol: meta.symbol,
      base: meta.base,
      quote: "USDT",
      name: meta.name,
      price: round(e.price),
      change24h: round(change, 2),
      volume24h: Math.round(vol),
      fundingRate: round(gaussian(e.rand, meta.drift * 0.002, 0.008), 4),
      openInterest: Math.round(vol * 0.4),
      high24h: round(e.price * (1 + Math.abs(change) / 100 + 0.01)),
      low24h: round(e.price * (1 - Math.abs(change) / 100 - 0.01)),
    };
  }

  async getCandles(symbol: string, timeframe: string, limit = 300): Promise<Candle[]> {
    const key = `${symbol}-${timeframe}`;
    const e = this.engineOf(symbol);
    const sec = TIMEFRAME_SECONDS[timeframe] ?? 14400;
    const candles = generateCandles({
      seed: this.seed + e.meta.symbol.length * 100 + e.meta.priority,
      count: limit,
      startPrice: e.meta.basePrice,
      drift: e.meta.drift / 100,
      volatility: e.meta.volatility,
      timeframeSeconds: sec,
    });
    // 把最后一根对齐到当前价格，保证图和 ticker 一致
    const last = candles[candles.length - 1];
    if (last) {
      const scale = e.price / last.close;
      for (const c of candles) {
        c.open = round(c.open * scale);
        c.high = round(c.high * scale);
        c.low = round(c.low * scale);
        c.close = round(c.close * scale);
      }
    }
    this.candlesCache.set(key, candles);
    return candles;
  }

  async getPositions(): Promise<Position[]> {
    return this.positions();
  }

  async getBalance(): Promise<ExchangeAccount> {
    const risk = this.riskSnapshot();
    return {
      exchange: "OKX",
      id: "acct-okx-0001",
      name: "Main Account",
      status: "CONNECTED",
      mode: "PAPER",
      equity: risk.accountEquity,
      availableMargin: risk.availableMargin,
      currency: "USDT",
    };
  }

  async getOrders(): Promise<Order[]> {
    return this.orders();
  }

  async getRegime(symbol: string): Promise<MarketRegime> {
    return this.regimeFor(symbol);
  }

  async getSignals(symbols: string[]): Promise<Record<string, Signal>> {
    const out: Record<string, Signal> = {};
    for (const s of symbols) out[s] = this.signalOf(s);
    return out;
  }

  async createOrder(order: Partial<Order>): Promise<Order> {
    // 阶段一：不连真实交易，仅返回回显确认
    return {
      id: `ord-${Date.now()}`,
      symbol: order.symbol ?? "BTCUSDT",
      side: order.side ?? "LONG",
      type: "MARKET",
      price: order.price ?? 0,
      size: order.size ?? 0,
      status: "PENDING",
      expectedPrice: order.expectedPrice ?? order.price ?? 0,
      actualPrice: order.expectedPrice ?? order.price ?? 0,
      slippage: 0,
      fee: 0,
      latencyMs: 0,
      createdAt: Date.now(),
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    void orderId;
  }

  async getSnapshot(symbols: string[]): Promise<TradingSnapshot> {
    this.tick += 1;
    // 每次快照前进价格，模拟实时
    for (const engine of this.engines) this.stepPrice(engine);

    const assets: Record<string, Asset> = {};
    const signals: Record<string, Signal> = {};
    for (const s of symbols) {
      assets[s] = this.assetOf(this.engineOf(s));
      signals[s] = this.signalOf(s);
    }

    return {
      mode: "PAPER",
      exchange: "OKX",
      dataSource: "MOCK",
      liveTradingEnabled: false,
      updatedAt: Date.now(),
      assets,
      regime: this.regimeFor(symbols[0] ?? "BTCUSDT"),
      signals,
      positions: this.positions(),
      orders: this.orders(),
      risk: this.riskSnapshot(),
      systemHealth: this.systemHealth(),
      alerts: this.alerts(),
      marketEvents: this.marketEvents(),
      analytics: this.analytics(),
      strategies: this.strategies(),
      executionStats: this.executionStats(),
      heatContributions: this.heatContributions(),
      discipline: this.discipline(),
    };
  }

  // ----------------------------------------------------------
  // 内部数据构造
  // ----------------------------------------------------------
  private signalOf(symbol: string): Signal {
    const e = this.engineOf(symbol);
    const state = this.regimeFor(symbol);
    const breakdown = buildBreakdown(e.meta, state.state, e.rand);
    const score = scoreFromBreakdown(breakdown);
    const setup = setupFromState(state.state, e.meta.drift, e.rand());
    const riskReward = setup === "NONE" ? 1.0 : round(clamp(1.5 + (score - 60) / 20 + gaussian(e.rand, 0, 0.4), 0.8, 4.5), 1);
    const stopPct = e.meta.volatility * 1.6;
    const entry = e.price;
    const stop = round(entry * (1 - stopPct));
    const target = round(entry * (1 + stopPct * riskReward));
    const risk: RiskLevel = score >= 80 ? "LOW" : score >= 60 ? "MEDIUM" : "HIGH";
    const stage: SetupStage =
      score >= 90 ? "ENTRY" : score >= 80 ? "RESTART" : score >= 65 ? "PULLBACK" : setup === "BREAKOUT" ? "BREAKOUT" : "WAIT";
    return {
      symbol,
      score,
      breakdown,
      trend: trendFromRegime(state.state),
      setup,
      setupStage: stage,
      action: actionFromScoreAndState(score, state.state),
      entry: round(entry),
      stop,
      target,
      riskReward,
      risk,
      reason: this.reasonFor(setup, state.state, score),
      updatedAt: Date.now(),
    };
  }

  private reasonFor(setup: SetupType, state: RegimeState, score: number): string {
    const parts: string[] = [];
    parts.push(state === "BULL_TREND" ? "HTF 多头对齐" : state === "BEAR_TREND" ? "空头趋势压制" : "震荡区间");
    if (setup === "PULLBACK") parts.push("回踩关键支撑后重启");
    else if (setup === "BREAKOUT") parts.push("突破旗形结构");
    else if (setup === "RE_ENTRY") parts.push("二次入场确认");
    else if (setup === "RANGE") parts.push("区间上下沿博弈");
    else parts.push("无明显结构");
    parts.push(score >= 85 ? "动量强劲" : score >= 65 ? "动量中性" : "动量偏弱");
    return parts.join(" · ");
  }

  private positions(): Position[] {
    const btc = this.engineOf("BTCUSDT");
    const eth = this.engineOf("ETHUSDT");
    const sol = this.engineOf("SOLUSDT");
    const now = Date.now();
    const equity = 12580;
    const makePosition = (
      id: string,
      symbol: string,
      side: "LONG" | "SHORT",
      price: number,
      sizeUsd: number,
      leverage: number,
      pnlPct: number,
      openedHoursAgo: number,
    ): Position => {
      const stopPct = 0.04;
      return {
        id,
        symbol,
        side,
        entry: round(price),
        markPrice: round(price * (1 + pnlPct / leverage / 100)),
        sizeUsd: Math.round(sizeUsd),
        leverage,
        stopLoss: round(side === "LONG" ? price * (1 - stopPct) : price * (1 + stopPct)),
        takeProfit: round(side === "LONG" ? price * (1 + stopPct * 2.2) : price * (1 - stopPct * 2.2)),
        liquidation: round(side === "LONG" ? price * (1 - 1 / leverage + 0.005) : price * (1 + 1 / leverage - 0.005)),
        unrealizedPnl: round((sizeUsd * pnlPct) / 100),
        unrealizedPnlPct: round(pnlPct, 2),
        riskPerTradePct: round((sizeUsd * stopPct) / equity * 100, 2),
        openedAt: now - openedHoursAgo * 3600 * 1000,
      };
    };
    return [
      makePosition("pos-1", "BTCUSDT", "LONG", btc.price, 10000, 5, 6.4, 9),
      makePosition("pos-2", "ETHUSDT", "LONG", eth.price, 5000, 3, 3.8, 18),
      makePosition("pos-3", "SOLUSDT", "LONG", sol.price, 3000, 4, -1.2, 4),
    ];
  }

  private orders(): Order[] {
    const btc = this.engineOf("BTCUSDT");
    const now = Date.now();
    const mk = (
      id: string,
      symbol: string,
      side: "LONG" | "SHORT",
      expected: number,
      slippage: number,
      fee: number,
      latency: number,
      minsAgo: number,
    ): Order => ({
      id,
      symbol,
      side,
      type: "MARKET",
      price: round(expected * (1 + slippage / 100)),
      size: 0.1,
      status: "FILLED",
      expectedPrice: round(expected),
      actualPrice: round(expected * (1 + slippage / 100)),
      slippage: round(slippage, 4),
      fee: round(fee, 2),
      latencyMs: latency,
      createdAt: now - minsAgo * 60 * 1000,
    });
    return [
      mk("ordcer-1", "BTCUSDT", "LONG", btc.price, 0.04, 2.1, 128, 5),
      mk("ordcer-2", "BTCUSDT", "LONG", btc.price, -0.02, 1.8, 96, 62),
      mk("ordcer-3", "ETHUSDT", "LONG", this.engineOf("ETHUSDT").price, 0.06, 1.4, 143, 143),
      mk("ordcer-4", "SOLUSDT", "LONG", this.engineOf("SOLUSDT").price, 0.03, 0.9, 112, 220),
    ];
  }

  private heatContributions(): RiskContribution[] {
    return [
      { symbol: "BTCUSDT", heat: 0.8, sizeUsd: 10000 },
      { symbol: "ETHUSDT", heat: 0.5, sizeUsd: 5000 },
      { symbol: "SOLUSDT", heat: 0.3, sizeUsd: 3000 },
      { symbol: "OTHER", heat: 0.2, sizeUsd: 2000 },
    ];
  }

  private riskSnapshot(): RiskSnapshot {
    const equity = 12580;
    const heat = 1.8;
    let status: RiskSnapshot["status"] = "SAFE";
    if (heat >= 6) status = "DANGER";
    else if (heat >= 4) status = "WARNING";
    else if (heat >= 2) status = "CAUTION";
    else status = "SAFE";
    return {
      accountEquity: equity,
      availableMargin: round(equity * 0.16),
      exposure: round(18000 / equity * 100, 1),
      portfolioHeat: heat,
      dailyRisk: 1.8,
      weeklyRisk: 3.4,
      maxDrawdown: 8.4,
      currentDrawdown: 4.2,
      liquidationDistance: 68,
      status,
    };
  }

  private systemHealth(): SystemHealth {
    const warnings: string[] = [];
    const pf90 = 1.57;
    const pf30 = 1.82;
    if (pf30 < 1) warnings.push("30D PF < 1，策略失效");
    if (pf90 < 1) warnings.push("90D PF < 1");
    const dd = 4.2;
    if (dd > 6) warnings.push("回撤异常");
    let status: SystemHealth["status"] = "NORMAL";
    if (warnings.length >= 3) status = "SYSTEM_FAILURE";
    else if (warnings.length >= 2) status = "SYSTEM_DEGRADATION";
    else if (warnings.length === 1) status = "WARNING";
    return {
      strategyStatus: "ACTIVE",
      pf30d: pf30,
      pf90d: pf90,
      currentDrawdown: dd,
      ruleCompliance: 96,
      executionQuality: 92,
      dataQuality: 100,
      status,
      warnings,
    };
  }

  private alerts(): Alert[] {
    const btc = this.engineOf("BTCUSDT").price;
    return [
      { id: "alt-1", type: "PRICE", message: `BTC > ${Math.round(btc * 1.15).toLocaleString()}`, status: "ACTIVE", severity: "INFO", createdAt: Date.now() - 3600e3 },
      { id: "alt-2", type: "SIGNAL", message: "BTC Signal > 90", status: "ACTIVE", severity: "INFO", createdAt: Date.now() - 7200e3 },
      { id: "alt-3", type: "RISK", message: "Portfolio Heat > 4%", status: "ACTIVE", severity: "CAUTION", createdAt: Date.now() - 10800e3 },
      { id: "alt-4", type: "SYSTEM", message: "Strategy PF < 1", status: "ACTIVE", severity: "WARNING", createdAt: Date.now() - 14400e3 },
      { id: "alt-5", type: "PRICE", message: "BTC breaks MA80", status: "TRIGGERED", severity: "INFO", createdAt: Date.now() - 86400e3 },
    ];
  }

  private marketEvents(): MarketEvent[] {
    return [
      { id: "evt-1", title: "BTC ETF Net Flow", impact: "BULLISH", confidence: 78, source: "ETF Aggregator", occurredAt: Date.now() - 3600e3 },
      { id: "evt-2", title: "ETH Whale Activity", impact: "BULLISH", confidence: 62, source: "On-chain", occurredAt: Date.now() - 7200e3 },
      { id: "evt-3", title: "SOL Open Interest Spike", impact: "NEUTRAL", confidence: 55, source: "Derivatives", occurredAt: Date.now() - 10800e3 },
      { id: "evt-4", title: "Fed Macro Event", impact: "BEARISH", confidence: 70, source: "Macro Calendar", occurredAt: Date.now() - 14400e3 },
      { id: "evt-5", title: "BTC Funding Extreme", impact: "BEARISH", confidence: 81, source: "Funding", occurredAt: Date.now() - 18000e3 },
    ];
  }

  private analytics(): AnalyticsSummary {
    return {
      winRate: 58.6,
      avgWin: 1280,
      avgLoss: -640,
      profitFactor: 1.82,
      expectancy: 0.71,
      avgR: 0.71,
      sharpe: 1.64,
      maxDrawdown: 8.4,
      calmar: 3.1,
      totalTrades: 187,
      netPnl: 42350,
    };
  }

  private strategies(): StrategyPerformance[] {
    const byRegime = (pfBull: number, pfRange: number, pfBear: number) => [
      { regime: "BULL_TREND" as RegimeState, profitFactor: pfBull, trades: 42 },
      { regime: "RANGE" as RegimeState, profitFactor: pfRange, trades: 31 },
      { regime: "BEAR_TREND" as RegimeState, profitFactor: pfBear, trades: 14 },
    ];
    return [
      {
        id: "strat-1",
        name: "BTC Pullback Strategy",
        symbol: "BTCUSDT",
        trades: 87,
        winRate: 63.2,
        avgWinner: 2.8,
        avgLoser: -1.0,
        profitFactor: 1.84,
        expectancy: 0.71,
        maxDrawdown: 8.4,
        byRegime: byRegime(2.31, 0.92, 0.61),
        verdict: "当前策略主要在 Bull Trend 环境有效",
      },
      {
        id: "strat-2",
        name: "ETH Breakout Strategy",
        symbol: "ETHUSDT",
        trades: 54,
        winRate: 51.9,
        avgWinner: 2.4,
        avgLoser: -1.0,
        profitFactor: 1.29,
        expectancy: 0.42,
        maxDrawdown: 11.2,
        byRegime: byRegime(1.62, 1.05, 0.58),
        verdict: "突破策略在多空趋势均有优势，震荡区间表现一般",
      },
      {
        id: "strat-3",
        name: "SOL Momentum Strategy",
        symbol: "SOLUSDT",
        trades: 46,
        winRate: 58.7,
        avgWinner: 3.1,
        avgLoser: -1.2,
        profitFactor: 1.72,
        expectancy: 0.66,
        maxDrawdown: 9.8,
        byRegime: byRegime(2.15, 0.82, 0.44),
        verdict: "动量策略高度依赖 Bull Trend",
      },
    ];
  }

  private executionStats(): ExecutionStats {
    return {
      avgSlippage: 0.03,
      avgFee: 0.04,
      avgLatencyMs: 118,
      fundingCost: 86,
      deviation: 0.08,
    };
  }

  private discipline(): DisciplineDaily[] {
    const days = ["08-24", "08-23", "08-22", "08-21", "08-20", "08-19", "08-18"];
    return days.map((d) => {
      const followed = Math.random() > 0.15;
      const overtrade = Math.random() < 0.1;
      const violate = Math.random() < 0.05;
      const fomo = Math.random() < 0.12;
      const score = clamp(100 - (followed ? 0 : 30) - (overtrade ? 15 : 0) - (violate ? 25 : 0) - (fomo ? 20 : 0), 0, 100);
      return { date: d, followedSystem: followed, overtraded: overtrade, violatedRiskRules: violate, enteredByFomo: fomo, disciplineScore: score };
    });
  }
}

export function createMockProvider(config: ProviderConfig): ExchangeProvider {
  return new MockExchangeProvider(config);
}

export { sma };