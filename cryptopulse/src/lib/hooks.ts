"use client";

import { useEffect, useRef, useState } from "react";
import { ticker } from "@/lib/data";

export interface LivePriceItem {
  symbol: string;
  price: number;
  change: number;
  live: boolean;
  source?: string;
}

export interface LiveNewsItem {
  id: string;
  title: string;
  source?: string;
  url?: string;
}

const TICKER_SYMBOLS = ticker.map((t) => t.symbol);

const withTimeout = (ms: number) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, t };
};

/* ---------------- 静态缓存（GitHub Actions 生成的同源 JSON，永无 CORS） ---------------- */

function basePath() {
  return (process.env.NEXT_PUBLIC_BASE_PATH as string) || "";
}

async function fetchStaticCache(): Promise<Partial<Record<string, LivePriceItem>>> {
  const path = `${basePath()}/prices.json`;
  const { ctrl, t } = withTimeout(6000);
  try {
    const res = await fetch(path, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<Record<string, LivePriceItem>> = {};
    const prices = data?.prices;
    if (prices && typeof prices === "object") {
      for (const sym of TICKER_SYMBOLS) {
        const p = prices[sym];
        if (p && typeof p.price === "number" && isFinite(p.price)) {
          out[sym] = {
            symbol: sym,
            price: p.price,
            change: typeof p.change === "number" ? p.change : 0,
            live: true,
            source: p.source || "缓存",
          };
        }
      }
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- Binance ---------------- */

async function fetchBinance(): Promise<Partial<Record<string, LivePriceItem>>> {
  const { ctrl, t } = withTimeout(6000);
  try {
    const [tickerRes, hrRes] = await Promise.all([
      fetch("https://api.binance.com/api/v3/ticker/price", { signal: ctrl.signal }),
      fetch("https://api.binance.com/api/v3/ticker/24hr", { signal: ctrl.signal }),
    ]);
    const prices = tickerRes.ok ? await tickerRes.json() : [];
    const changes = hrRes.ok ? await hrRes.json() : [];
    if (!Array.isArray(prices)) return {};
    const changeMap = new Map<string, number>();
    for (const c of changes) {
      const open = parseFloat(c?.openPrice);
      const price = parseFloat(c?.lastPrice);
      if (isFinite(open) && isFinite(price) && open > 0) changeMap.set(c.symbol, ((price - open) / open) * 100);
    }
    const out: Partial<Record<string, LivePriceItem>> = {};
    for (const p of prices) {
      const base = p?.symbol?.replace(/USDT$/, "");
      if (TICKER_SYMBOLS.includes(base) && isFinite(parseFloat(p.price))) {
        out[base] = { symbol: base, price: parseFloat(p.price), change: changeMap.get(p.symbol) ?? 0, live: true, source: "Binance" };
      }
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- HTX ---------------- */

const HTX_TO_SYMBOL: Record<string, string> = {
  btc: "BTC", eth: "ETH", sol: "SOL", bnbusdt: "BNB", xrp: "XRP", hype: "HYPE",
  doge: "DOGE", onda: "ONDO", link: "LINK", aave: "AAVE", avax: "AVAX",
  sui: "SUI", tia: "TIA", ena: "ENA", pepe: "PEPE", wif: "WIF",
};

async function fetchHtxSymbols(symbols: string[]): Promise<Partial<Record<string, LivePriceItem>>> {
  const out: Partial<Record<string, LivePriceItem>> = {};
  for (const sym of symbols) {
    const { ctrl, t } = withTimeout(3000);
    try {
      const res = await fetch(`https://api.huobi.pro/market/detail/merged?symbol=${sym}usdt`, {
        signal: ctrl.signal,
      });
      if (!res.ok) continue;
      const json = await res.json();
      const tick = json?.tick;
      const code = HTX_TO_SYMBOL[sym.toLowerCase()];
      if (tick && code) {
        const price = parseFloat(tick.close);
        const open = parseFloat(tick.open);
        if (isFinite(price)) {
          out[code] = {
            symbol: code,
            price,
            change: isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0,
            live: true,
            source: "HTX",
          };
        }
      }
    } catch {
      // 静默跳过
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}

async function fetchHtx(): Promise<Partial<Record<string, LivePriceItem>>> {
  // 分批请求，避免触发限流
  const batches: string[][] = [];
  for (let i = 0; i < TICKER_SYMBOLS.length; i += 8) batches.push(TICKER_SYMBOLS.slice(i, i + 8));
  const results = await Promise.all(batches.map((b) => fetchHtxSymbols(b)));
  const out: Partial<Record<string, LivePriceItem>> = {};
  for (const r of results) Object.assign(out, r);
  return out;
}

/* ---------------- CoinEx / Gate / CoinGecko（尽力而为的备用源） ---------------- */

async function fetchCoinEx(): Promise<Partial<Record<string, LivePriceItem>>> {
  const { ctrl, t } = withTimeout(6000);
  try {
    const res = await fetch("https://api.coinex.com/v1/market/ticker/all", { signal: ctrl.signal });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<Record<string, LivePriceItem>> = {};
    for (const sym of TICKER_SYMBOLS) {
      const row = data?.data?.[sym + "USDT"]?.ticker ?? data?.data?.[sym + "USDT"];
      const last = parseFloat(row?.last);
      const open = parseFloat(row?.open);
      if (isFinite(last)) {
        out[sym] = { symbol: sym, price: last, change: isFinite(open) && open > 0 ? ((last - open) / open) * 100 : 0, live: true, source: "CoinEx" };
      }
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

async function fetchGate(): Promise<Partial<Record<string, LivePriceItem>>> {
  const { ctrl, t } = withTimeout(6000);
  try {
    const res = await fetch("https://api.gateio.ws/api/v4/spot/tickers", { signal: ctrl.signal });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<Record<string, LivePriceItem>> = {};
    for (const row of data || []) {
      const base = (row?.currency_pair || "").replace("_USDT", "");
      if (TICKER_SYMBOLS.includes(base)) {
        const last = parseFloat(row?.last);
        const changePct = parseFloat(row?.change_percentage);
        if (isFinite(last)) out[base] = { symbol: base, price: last, change: isFinite(changePct) ? changePct : 0, live: true, source: "Gate.io" };
      }
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

const COINGECKO_ID: Record<string, string[]> = {
  BTC: ["bitcoin"], ETH: ["ethereum"], SOL: ["solana"], BNB: ["binancecoin"],
  XRP: ["ripple"], HYPE: ["hyperliquid"], DOGE: ["dogecoin"], ONDO: ["ondo-finance"],
  LINK: ["chainlink"], AAVE: ["aave"], AVAX: ["avalanche-2"], SUI: ["sui"],
  TIA: ["celestia"], ENA: ["ethena"], PEPE: ["pepe"], WIF: ["dogwifcoin"],
};

async function fetchCoinGecko(): Promise<Partial<Record<string, LivePriceItem>>> {
  const ids = TICKER_SYMBOLS.flatMap((s) => COINGECKO_ID[s] || []);
  const { ctrl, t } = withTimeout(8000);
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { signal: ctrl.signal }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<Record<string, LivePriceItem>> = {};
    for (const sym of TICKER_SYMBOLS) {
      const id = COINGECKO_ID[sym]?.[0];
      const row = data?.[id];
      const price = row?.usd;
      if (isFinite(price)) out[sym] = { symbol: sym, price, change: row?.usd_24h_change ?? 0, live: true, source: "CoinGecko" };
    }
    return out;
  } catch {
    return {};
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- 合并（已有数据优先） ---------------- */

function merge(base: Partial<Record<string, LivePriceItem>>, add: Partial<Record<string, LivePriceItem>>) {
  for (const sym of TICKER_SYMBOLS) {
    if (!base[sym] && add[sym]) base[sym] = add[sym];
  }
}

/* ---------------- useLivePrices ---------------- */

export function useLivePrices() {
  const [bySymbol, setBySymbol] = useState<Record<string, LivePriceItem>>({});
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    let active = true;

    async function run() {
      const acc: Partial<Record<string, LivePriceItem>> = {};
      await fetchStaticCache().then((r) => merge(acc, r));
      merge(acc, await fetchBinance());
      merge(acc, await fetchHtx());
      merge(acc, await fetchCoinEx());
      merge(acc, await fetchGate());
      merge(acc, await fetchCoinGecko());
      if (active) {
        setBySymbol(acc as Record<string, LivePriceItem>);
        setFetched(true);
      }
    }

    run();
    const id = setInterval(run, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const prices: LivePriceItem[] = TICKER_SYMBOLS.map((sym) => {
    const live = bySymbol[sym];
    const base = ticker.find((t) => t.symbol === sym);
    if (!live) return { symbol: sym, price: base?.price ?? 0, change: base?.change ?? 0, live: false, source: "本地基准" };
    return live;
  });

  const liveCount = prices.filter((p) => p.live).length;
  const anyLive = liveCount > 0;

  return { prices, bySymbol, liveCount, anyLive, fetched };
}

/* ---------------- useLiveNews（同源 news.json，GitHub Actions 每 N 分钟生成） ---------------- */

export function useLiveNews() {
  const [items, setItems] = useState<LiveNewsItem[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = `${basePath()}/news.json`;
      const { ctrl, t } = withTimeout(6000);
      try {
        const res = await fetch(path, { signal: ctrl.signal, cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data?.items) && data.items.length) {
            setItems(
              data.items.map((n: LiveNewsItem) => ({ id: n.id, title: n.title, source: n.source || "实时", url: n.url }))
            );
            setUpdatedAt(data.ts ? data.ts * 1000 : Date.now());
          }
        }
      } catch {
        // 忽略，保持现状
      } finally {
        clearTimeout(t);
      }
    };
    load();
    timerRef.current = setInterval(load, 60000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { items, updatedAt, isLive: items !== null };
}