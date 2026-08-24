import { NextRequest } from "next/server";
import type { Candle } from "@/types";

// Binance 公开市场数据端点（无需 API Key）
const ENDPOINT = "https://data-api.binance.vision/api/v3/klines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERVAL: Record<string, string> = {
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
  "1W": "1w",
};

type Kline = [number, string, string, string, string, string];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get("symbol");
  const timeframe = sp.get("interval") ?? "4H";
  const limit = Math.min(parseInt(sp.get("limit") ?? "300", 10) || 300, 500);

  if (!symbol) return Response.json({ error: "symbol 参数不能为空" }, { status: 400 });
  const interval = INTERVAL[timeframe] ?? "4h";

  const url = `${ENDPOINT}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}`);
    const rows = (await res.json()) as Kline[];

    const candles: Candle[] = rows.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
    return Response.json(candles);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "K 线获取失败" },
      { status: 502 },
    );
  }
}