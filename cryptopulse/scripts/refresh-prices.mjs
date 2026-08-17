import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "HYPE", "DOGE", "ONDO", "LINK", "AAVE", "AVAX", "SUI", "TIA", "ENA", "PEPE", "WIF"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (fetchPromise, ms) =>
  Promise.race([fetchPromise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function getJson(url, ms = 9000) {
  const res = await withTimeout(fetch(url), ms);
  if (!res.ok) throw new Error("bad status " + res.status);
  return res.json();
}

/* Binance */
async function binance() {
  const out = {};
  try {
    const [prices, hr] = await Promise.all([
      getJson("https://api.binance.com/api/v3/ticker/price?symbols=" + JSON.stringify(SYMBOLS.map((s) => s + "USDT"))),
      getJson("https://api.binance.com/api/v3/ticker/24hr?symbols=" + JSON.stringify(SYMBOLS.map((s) => s + "USDT"))),
    ]);
    const changeMap = {};
    for (const c of hr) {
      const open = parseFloat(c.openPrice);
      const last = parseFloat(c.lastPrice);
      if (isFinite(open) && isFinite(last) && open > 0) changeMap[c.symbol] = ((last - open) / open) * 100;
    }
    for (const p of prices) {
      const base = p.symbol.replace("USDT", "");
      if (isFinite(parseFloat(p.price))) out[base] = { price: parseFloat(p.price), change: changeMap[p.symbol] ?? 0, source: "Binance" };
    }
  } catch {}
  return out;
}

/* HTX */
const htxMap = {
  BTC: "btc", ETH: "eth", SOL: "sol", BNB: "bnbusdt", XRP: "xrp", HYPE: "hype",
  DOGE: "doge", ONDO: "onda", LINK: "link", AAVE: "aave", AVAX: "avax",
  SUI: "sui", TIA: "tia", ENA: "ena", PEPE: "pepe", WIF: "wif",
};
async function htx() {
  const out = {};
  for (const sym of SYMBOLS) {
    const code = htxMap[sym];
    if (!code) continue;
    try {
      const json = await getJson(`https://api.huobi.pro/market/detail/merged?symbol=${code}usdt`, 4000);
      const tick = json?.tick;
      const price = parseFloat(tick?.close);
      const open = parseFloat(tick?.open);
      if (isFinite(price)) out[sym] = { price, change: isFinite(open) && open > 0 ? ((price - open) / open) * 100 : 0, source: "HTX" };
    } catch {}
    await sleep(120);
  }
  return out;
}

/* CoinEx */
async function coinex() {
  const out = {};
  try {
    const data = await getJson("https://api.coinex.com/v1/market/ticker/all");
    for (const sym of SYMBOLS) {
      const row = data?.data?.[sym + "USDT"]?.ticker;
      const last = parseFloat(row?.last);
      const open = parseFloat(row?.open);
      if (isFinite(last)) out[sym] = { price: last, change: isFinite(open) && open > 0 ? ((last - open) / open) * 100 : 0, source: "CoinEx" };
    }
  } catch {}
  return out;
}

/* Gate.io */
async function gate() {
  const out = {};
  try {
    const data = await getJson("https://api.gateio.ws/api/v4/spot/tickers");
    for (const row of data || []) {
      const base = (row.currency_pair || "").replace("_USDT", "");
      const last = parseFloat(row.last);
      const change = parseFloat(row.change_percentage);
      if (SYMBOLS.includes(base) && isFinite(last)) out[base] = { price: last, change: isFinite(change) ? change : 0, source: "Gate.io" };
    }
  } catch {}
  return out;
}

/* CoinGecko */
const cgId = {
  BTC: "bitcoin", ETH: "ethereum", SOL: "solana", BNB: "binancecoin", XRP: "ripple",
  HYPE: "hyperliquid", DOGE: "dogecoin", ONDO: "ondo-finance", LINK: "chainlink",
  AAVE: "aave", AVAX: "avalanche-2", SUI: "sui", TIA: "celestia", ENA: "ethena",
  PEPE: "pepe", WIF: "dogwifcoin",
};
async function coingecko() {
  const out = {};
  try {
    const ids = SYMBOLS.map((s) => cgId[s]).filter(Boolean);
    const data = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`);
    for (const sym of SYMBOLS) {
      const row = data?.[cgId[sym]];
      if (isFinite(row?.usd)) out[sym] = { price: row.usd, change: row?.usd_24h_change ?? 0, source: "CoinGecko" };
    }
  } catch {}
  return out;
}

function merge(base, add) {
  for (const sym of Object.keys(add)) {
    if (!base[sym] && add[sym]) base[sym] = add[sym];
  }
}

/* 实时新闻：优先 CryptoCompare，失败回退 Cointelegraph 镜像类公开源 */
async function news() {
  const items = [];
  const sources = [];
  const push = (title, source, url) => items.push({ id: String(items.length + 1), title, source, url });

  try {
    const data = await getJson("https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest", 10000);
    const rows = data?.Data || [];
    for (const r of rows.slice(0, 20)) {
      push(r.title, r.source_info?.name || "CryptoCompare", r.url);
      if (sources.length < 5 && r.source_info?.name) sources.push(r.source_info.name);
    }
  } catch {}

  if (!items.length) {
    try {
      const data = await getJson("https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fcointelegraph.com%2Frss", 10000);
      for (const r of (data?.items || []).slice(0, 20)) {
        push(r.title || r.title || "", "Cointelegraph", r.link);
      }
    } catch {}
  }

  return { items: items.slice(0, 20), updatedAt: new Date().toISOString() };
}

async function main() {
  const acc = {};
  merge(acc, await binance());
  merge(acc, await htx());
  merge(acc, await coinex());
  merge(acc, await gate());
  merge(acc, await coingecko());

  const output = { ts: Math.floor(Date.now() / 1000), updatedAt: new Date().toISOString(), prices: acc };
  const newsData = await news();
  const newsOutput = { ts: Math.floor(Date.now() / 1000), updatedAt: newsData.updatedAt, items: newsData.items };

  await mkdir(PUBLIC_DIR, { recursive: true });
  await Promise.all([
    writeFile(path.join(PUBLIC_DIR, "prices.json"), JSON.stringify(output, null, 2)),
    writeFile(path.join(PUBLIC_DIR, "news.json"), JSON.stringify(newsOutput, null, 2)),
  ]);
  console.log(`[refresh-prices] ${new Date().toISOString()} prices=${Object.keys(acc).length} news=${newsData.items.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});