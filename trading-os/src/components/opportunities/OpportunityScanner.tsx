"use client";

import { useMemo, useState } from "react";
import { useTradingStore, buildOpportunities } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ACTION_LABEL, actionTone, riskTone, RISK_LABEL } from "@/lib/labels";
import { formatPrice, formatPct, cn } from "@/lib/utils";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import type { Opportunity } from "@/types";

type SortKey = "score" | "price" | "change24h" | "riskReward";

export function OpportunityScanner() {
  const snapshot = useTradingStore((s) => s.snapshot);
  const openOpportunity = useTradingStore((s) => s.openOpportunity);
  const [query, setQuery] = useState("");
  const [trendFilter, setTrendFilter] = useState<string>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [desc, setDesc] = useState(true);

  const rows = useMemo(() => {
    if (!snapshot) return [];
    let list = buildOpportunities(snapshot);
    if (query.trim()) {
      const q = query.trim().toUpperCase();
      list = list.filter((o) => o.symbol.toUpperCase().includes(q) || o.name.toUpperCase().includes(q));
    }
    if (trendFilter !== "ALL") list = list.filter((o) => o.trend === trendFilter);
    list = [...list].sort((a, b) => {
      const dir = desc ? -1 : 1;
      // 保持 BTC 优先级固定：score 优先，其余按响应列
      if (sortKey === "score") return (a.score - b.score) * dir;
      if (sortKey === "price") return (a.price - b.price) * dir;
      if (sortKey === "change24h") return (a.change24h - b.change24h) * dir;
      return (a.riskReward - b.riskReward) * dir;
    });
    return list;
  }, [snapshot, query, trendFilter, sortKey, desc]);

  if (!snapshot) return null;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setDesc((d) => !d);
    else {
      setSortKey(key);
      setDesc(true);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Market Opportunities</h3>
          <Badge tone="neutral">{rows.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索币种"
              className="h-8 w-40 rounded-md border border-border bg-surface pl-7 pr-2 text-xs text-text placeholder:text-muted focus:border-info focus:outline-none"
            />
          </div>
          <select
            value={trendFilter}
            onChange={(e) => setTrendFilter(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text focus:border-info focus:outline-none"
          >
            <option value="ALL">全部趋势</option>
            <option value="BULL">Bull</option>
            <option value="BEAR">Bear</option>
            <option value="RANGE">Range</option>
            <option value="TRANSITION">Transition</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <SortTh label="Coin" onClick={() => toggleSort("price")} active={sortKey === "price"} desc={desc} />
              <SortTh label="Score" onClick={() => toggleSort("score")} active={sortKey === "score"} desc={desc} />
              <th className="px-2 py-2 font-medium">Trend</th>
              <th className="px-2 py-2 font-medium">Setup</th>
              <SortTh label="R:R" onClick={() => toggleSort("riskReward")} active={sortKey === "riskReward"} desc={desc} />
              <th className="px-2 py-2 font-medium">Risk</th>
              <th className="px-2 py-2 font-medium">Action</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <Row key={o.symbol} o={o} onClick={() => openOpportunity(o)} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function SortTh({
  label,
  onClick,
  active,
  desc,
}: {
  label: string;
  onClick: () => void;
  active: boolean;
  desc: boolean;
}) {
  return (
    <th className="px-2 py-2 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1", active ? "text-text" : "text-muted")}>
        {label}
        {active ? desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-50" />}
      </button>
    </th>
  );
}

function Row({ o, onClick }: { o: Opportunity; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer border-b border-border/60 transition-colors hover:bg-white/5">
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold text-text">
            {o.symbol.replace("USDT", "").slice(0, 3)}
          </div>
          <div>
            <div className="font-medium text-text">{o.symbol.replace("USDT", "")}</div>
            <div className="num text-[11px] text-muted">{formatPrice(o.price)}</div>
          </div>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-1.5 w-10 overflow-hidden rounded-full bg-surface">
            <div
              className={cn("h-full", o.score >= 80 ? "bg-bull" : o.score >= 60 ? "bg-warn" : "bg-bear")}
              style={{ width: `${o.score}%` }}
            />
          </div>
          <span className="num font-semibold text-text">{o.score}</span>
        </div>
      </td>
      <td className="px-2 py-2.5">
        <TrendPill trend={o.trend} />
      </td>
      <td className="px-2 py-2.5 text-xs text-text">{o.setup}</td>
      <td className="num px-2 py-2.5 text-text">{o.riskReward.toFixed(1)}</td>
      <td className="px-2 py-2.5">
        <Badge tone={riskTone(o.risk)}>{RISK_LABEL[o.risk]}</Badge>
      </td>
      <td className="px-2 py-2.5">
        <Badge tone={actionTone(o.action)}>{ACTION_LABEL[o.action]}</Badge>
      </td>
      <td className="px-2 py-2.5 text-right">
        <ChevronRight className="ml-auto h-4 w-4 text-muted" />
      </td>
    </tr>
  );
}

function TrendPill({ trend }: { trend: string }) {
  if (trend === "BULL") return <span className="text-xs font-semibold text-bull">↑↑</span>;
  if (trend === "TRANSITION") return <span className="text-xs font-semibold text-purple-400">↗</span>;
  if (trend === "RANGE") return <span className="text-xs font-semibold text-warn">→</span>;
  return <span className="text-xs font-semibold text-bear">↓</span>;
}