import { NextRequest } from "next/server";
import type { Asset } from "@/types";

// Binance 公开市场数据端点（无需 API Key，仅行情，不涉及账户/交易）
const ENDPOINT = "https://data-api.binance.vision/api/v3/ticker/24hr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
};

function toAsset(t: BinanceTicker): Asset {
  const base = t.symbol.replace(/USDT$/, "");
  return {
    symbol: t.symbol,
    base,
    quote: "USDT",
    name: base,
    price: parseFloat(t.lastPrice),
    change24h: parseFloat(t.priceChangePercent ?? "0"),
    volume24h: parseFloat(t.quoteVolume ?? "0"),
    fundingRate: 0,
    openInterest: 0,
    high24h: parseFloat(t.highPrice ?? t.lastPrice),
    low24h: parseFloat(t.lowPrice ?? t.lastPrice),
  };
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return Response.json({ error: "symbols 参数不能为空" }, { status: 400 });
  }

  const url = `${ENDPOINT}?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}`);
    const arr = (await res.json()) as BinanceTicker[];

    const out: Record<string, Asset> = {};
    for (const t of arr) out[t.symbol] = toAsset(t);
    return Response.json(out);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "行情获取失败" },
      { status: 502 },
    );
  }
}