"use client";

import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { COINS } from "@/services/mock/universe";
import { cn } from "@/lib/utils";

export function SettingsPanel() {
  const settings = useTradingStore((s) => s.settings);
  const update = useTradingStore((s) => s.updateSettings);
  const snapshot = useTradingStore((s) => s.snapshot);

  const hasCreds = Boolean(settings.apiKey && settings.apiSecret);
  const src = snapshot?.dataSource ?? "MOCK";
  const srcMeta: Record<string, { label: string; tone: "bull" | "warn" | "neutral" }> = {
    MOCK: { label: "模拟数据", tone: "neutral" },
    LIVE_OKX: { label: "OKX 实时行情", tone: "bull" },
    LIVE_BINANCE: { label: "Binance 实时行情", tone: "bull" },
    FALLBACK: { label: "降级模拟（实时不可达）", tone: "warn" },
  };
  const cur = srcMeta[src];

  function toggleLiveTrading() {
    if (settings.liveTradingEnabled) {
      update({ liveTradingEnabled: false });
      return;
    }
    if (!hasCreds) return;
    const ok = window.confirm(
      "确认开启真实交易？将使用已配置的 API 凭证提交真实订单，可能造成实际资金损失。请再次确认。",
    );
    if (ok) update({ liveTradingEnabled: true });
  }

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
        <CardHeader
          title="数据源与连接"
          subtitle="切换实时行情来源；真实下单默认关闭"
          right={<Badge tone={cur.tone} dot>{cur.label}</Badge>}
        />
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted">数据源</label>
            <select
              value={settings.dataProvider}
              onChange={(e) => update({ dataProvider: e.target.value as never, liveTradingEnabled: false })}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
            >
              <option value="MOCK">模拟数据</option>
              <option value="OKX">OKX 现货行情</option>
              <option value="BINANCE">Binance 现货行情</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(
              [
                ["apiKey", "API Key"],
                ["apiSecret", "API Secret"],
                ["apiPassphrase", "Passphrase（OKX）"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <label className="mb-1 block text-xs text-muted">{label}</label>
                <input
                  type="password"
                  autoComplete="off"
                  value={settings[k] ?? ""}
                  onChange={(e) => update({ [k]: e.target.value } as never)}
                  placeholder="未配置"
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface/50 px-3 py-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text">真实交易（允许提交真实订单）</span>
                {snapshot?.liveTradingEnabled && <Badge tone="bear" dot>已开启</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                {hasCreds
                  ? "已填写凭证。开启前会再次确认，请谨慎操作。"
                  : "需先配置 API Key 与 Secret 后方可开启。"}
              </p>
            </div>
            <button
              onClick={toggleLiveTrading}
              disabled={!hasCreds && !settings.liveTradingEnabled}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                settings.liveTradingEnabled ? "bg-bear" : "bg-border",
              )}
              aria-checked={settings.liveTradingEnabled}
              role="switch"
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                  settings.liveTradingEnabled ? "left-[22px]" : "left-0.5",
                )}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="风控参数" subtitle="组合热度分级阈值可自定义" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {num("riskPerTrade", "单笔风险 (%)", 0.1, 5, 0.1)}
          {num("maxPortfolioHeat", "最大组合热度 (%)", 1, 20, 0.5)}
          {num("defaultLeverage", "默认杠杆", 1, 100, 1)}
          {num("signalThreshold", "信号阈值", 0, 100, 1)}
        </div>
      </Card>

      <Card>
        <CardHeader title="热度分级阈值" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["heatSafe", "安全 <", 2],
              ["heatCaution", "谨慎 <", 4],
              ["heatWarning", "警告 <", 6],
              ["heatDanger", "危险 ≥", 6],
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
            <label className="mb-1 block text-xs text-muted">交易所</label>
            <select
              value={settings.exchange}
              onChange={(e) => update({ exchange: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
            >
              <option>OKX</option><option>BINANCE</option><option>BYBIT</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">首选周期</label>
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
        <CardHeader title="自选列表" subtitle="点击切换关注标的" />
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