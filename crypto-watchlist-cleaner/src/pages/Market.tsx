// =============================================================
// 全市场 —— 高级过滤器 + 主表格 + CSV 导出
// 所有筛选维度来自 config/filters.ts，可配置。
// =============================================================
import { useMemo, useState } from "react";
import { Search, Download, FilterX } from "lucide-react";
import { useCryptoStore } from "../store";
import { CoinTable } from "../components/CoinTable";
import { Panel } from "../components/ui";
import {
  MARKET_CAP_FILTERS,
  TREND_FILTERS,
  YTD_FILTERS,
  VOLUME_FILTERS,
  HOLDER_FILTERS,
  SMART_MONEY_FILTERS,
  NARRATIVE_FILTERS,
  GRADE_FILTERS,
  type FilterOption,
} from "../lib/config/filters";
import { NARRATIVE_LABELS } from "../lib/config/narratives";
import type { ScoredCoin, NarrativeTag } from "../lib/types";

export default function Market() {
  const coins = useCryptoStore((s) => s.coins);
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<string>("all");
  const [cap, setCap] = useState<string>("all");
  const [trend, setTrend] = useState<string>("all");
  const [ytd, setYtd] = useState<string>("all");
  const [vol, setVol] = useState<string>("all");
  const [holder, setHolder] = useState<string>("all");
  const [sm, setSm] = useState<string>("all");
  const [narr, setNarr] = useState<Set<NarrativeTag>>(new Set());

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return coins.filter((c) => {
      if (kw && !(c.symbol.toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw)))
        return false;
      if (grade !== "all") {
        if (grade === "SABC") {
          if (!["S", "A", "B"].includes(c.grade)) return false;
        } else if (c.grade !== grade) return false;
      }
      if (!pass(c, cap, MARKET_CAP_FILTERS)) return false;
      if (!pass(c, trend, TREND_FILTERS)) return false;
      if (!pass(c, ytd, YTD_FILTERS)) return false;
      if (!pass(c, vol, VOLUME_FILTERS)) return false;
      if (!pass(c, holder, HOLDER_FILTERS)) return false;
      if (!pass(c, sm, SMART_MONEY_FILTERS)) return false;
      if (narr.size > 0 && !c.narrative.tags.some((t) => narr.has(t))) return false;
      return true;
    });
  }, [coins, q, grade, cap, trend, ytd, vol, holder, sm, narr]);

  const hasFilter =
    q !== "" || grade !== "all" || cap !== "all" || trend !== "all" ||
    ytd !== "all" || vol !== "all" || holder !== "all" || sm !== "all" || narr.size > 0;

  const reset = () => {
    setQ("");
    setGrade("all");
    setCap("all");
    setTrend("all");
    setYtd("all");
    setVol("all");
    setHolder("all");
    setSm("all");
    setNarr(new Set());
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-terminal-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索币种 / 名称"
            className="w-48 rounded-md border border-terminal-border bg-terminal-panel py-1.5 pl-8 pr-3 text-[13px] text-terminal-bright outline-none focus:border-emerald-500/50"
          />
        </div>

        <Select value={grade} onChange={setGrade} options={[{ value: "all", label: "全部评级" }, ...GRADE_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={cap} onChange={setCap} options={[{ value: "all", label: "市值" }, ...MARKET_CAP_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={trend} onChange={setTrend} options={[{ value: "all", label: "趋势" }, ...TREND_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={ytd} onChange={setYtd} options={[{ value: "all", label: "YTD" }, ...YTD_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={vol} onChange={setVol} options={[{ value: "all", label: "成交量" }, ...VOLUME_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={holder} onChange={setHolder} options={[{ value: "all", label: "Holder" }, ...HOLDER_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />
        <Select value={sm} onChange={setSm} options={[{ value: "all", label: "Smart Money" }, ...SMART_MONEY_FILTERS.map((f) => ({ value: f.value, label: f.label }))]} />

        <button
          onClick={exportCsv(filtered)}
          className="inline-flex items-center gap-1.5 rounded-md border border-terminal-border px-2.5 py-1.5 text-[12px] text-terminal-muted transition-colors hover:text-terminal-bright"
        >
          <Download size={14} /> 导出 CSV
        </button>

        {hasFilter && (
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[12px] text-rose-400"
          >
            <FilterX size={14} /> 清除
          </button>
        )}
      </div>

      {/* 叙事多选 */}
      <Panel title={`叙事赛道${narr.size ? `（已选 ${narr.size}）` : ""}`} className="!p-0">
        <div className="flex flex-wrap gap-1.5 p-3">
          {NARRATIVE_FILTERS.map((f) => {
            const on = narr.has(f.value);
            return (
              <button
                key={f.value}
                onClick={() => {
                  const next = new Set(narr);
                  if (on) next.delete(f.value);
                  else next.add(f.value);
                  setNarr(next);
                }}
                className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                  on
                    ? "border-violet-500/50 bg-violet-500/15 text-violet-400"
                    : "border-terminal-border text-terminal-muted hover:text-terminal-fg"
                }`}
              >
                {NARRATIVE_LABELS[f.value]}
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="flex items-center justify-between">
        <span className="text-[12px] text-terminal-muted">共 {filtered.length} 个币种</span>
      </div>

      <CoinTable coins={filtered} emptyText="没有符合条件的币种，尝试放宽筛选" />
    </div>
  );
}

function pass(c: ScoredCoin, value: string, filters: FilterOption[]): boolean {
  if (value === "all") return true;
  const f = filters.find((x) => x.value === value);
  return f ? f.test(c) : true;
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-terminal-border bg-terminal-panel px-2 py-1.5 text-[12px] text-terminal-bright outline-none focus:border-emerald-500/50"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function exportCsv(coins: ScoredCoin[]) {
  return () => {
    if (coins.length === 0) return;
    const rows = [
      ["Rank", "Symbol", "Name", "Price", "MarketCap", "YTD", "7D", "30D", "90D", "RS-BTC", "Volume", "VolChange", "Holder7D", "SmartMoney", "Narrative", "Catalyst", "Score", "Grade"],
      ...coins.map((c) => [
        c.rank,
        c.symbol,
        c.name,
        c.price,
        c.marketCap,
        c.returnsPct.ytd,
        c.returnsPct.d7,
        c.returnsPct.d30,
        c.returnsPct.d90,
        c.rsBtc,
        c.volume24h,
        c.volume.changePct,
        c.holder.d7,
        c.smartMoney.netflow,
        c.narrative.tags.join("|"),
        c.catalyst.events.length,
        c.finalScore,
        c.grade,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crypto-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
}