"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/Card";
import { COINS } from "@/services/mock/universe";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const settings = useTradingStore((s) => s.settings);
  const update = useTradingStore((s) => s.updateSettings);

  const num = (key: "riskPerTrade" | "maxPortfolioHeat" | "defaultLeverage" | "signalThreshold", label: string, min = 0, max = 100, step = 0.1) => (
    <div>
      <label className="mb-1 block text-xs text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={settings[key]}
          onChange={(e) => update({ [key]: parseFloat(e.target.value) } as never)}
          className="flex-1 accent-[#3B82F6]"
        />
        <span className="num w-14 rounded bg-surface px-2 py-1 text-center text-xs text-text">
          {settings[key]}
        </span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="风控参数" subtitle="Portfolio Heat 分级阈值可自定义" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("riskPerTrade", "Risk Per Trade (%)", 0.1, 5, 0.1)}
          {num("maxPortfolioHeat", "Max Portfolio Heat (%)", 1, 20, 0.5)}
          {num("defaultLeverage", "Default Leverage", 1, 100, 1)}
          {num("signalThreshold", "Signal Threshold", 0, 100, 1)}
        </div>
      </Card>

      <Card>
        <CardHeader title="Heat 分级阈值" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["heatSafe", "SAFE <", 2],
              ["heatCaution", "CAUTION <", 4],
              ["heatWarning", "WARNING <", 6],
              ["heatDanger", "DANGER ≥", 6],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <label className="mb-1 block text-xs text-muted">{label}</label>
              <input
                type="number"
                value={settings[k]}
                onChange={(e) => update({ [k]: parseFloat(e.target.value) || 0 } as never)}
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
              />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="交易偏好" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted">Exchange</label>
            <select
              value={settings.exchange}
              onChange={(e) => update({ exchange: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
            >
              <option>OKX</option><option>BINANCE</option><option>BYBIT</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Preferred Timeframe</label>
            <select
              value={settings.preferredTimeframe}
              onChange={(e) => update({ preferredTimeframe: e.target.value as never })}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
            >
              <option>1H</option><option>4H</option><option>1D</option><option>1W</option>
            </select>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Watchlist" subtitle="点击切换关注标的" />
        <div className="flex flex-wrap gap-2">
          {COINS.map((c) => {
            const on = settings.watchlist.includes(c.symbol);
            return (
              <button
                key={c.symbol}
                onClick={() => {
                  const next = on
                    ? settings.watchlist.filter((s) => s !== c.symbol)
                    : [...settings.watchlist, c.symbol];
                  update({ watchlist: next });
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  on ? "border-bull/40 bg-bull/10 text-bull" : "border-border text-muted hover:border-muted",
                )}
              >
                {c.base}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}