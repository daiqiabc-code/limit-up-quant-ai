// =============================================================
// 主数据表（Bloomberg / TradingView 风格，可排序）
// =============================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { ScoredCoin } from "../lib/types";
import { useCryptoStore } from "../store";
import {
  fmtPrice,
  fmtCompact,
  fmtPct,
  colorBy,
  fmtScore,
} from "../lib/utils/format";
import { GradeBadge } from "./GradeBadge";
import { narrative100 } from "../lib/scoring/narrative";
import { catalyst100 } from "../lib/scoring/catalyst";

type SortKey =
  | "rank"
  | "price"
  | "marketCap"
  | "ytd"
  | "d7"
  | "d30"
  | "d90"
  | "rsBtc"
  | "volume"
  | "volChange"
  | "holder"
  | "smartMoney"
  | "narrative"
  | "catalyst"
  | "finalScore";

const COLS: { key: SortKey | "coin" | "grade"; label: string; align?: "right"; sortable?: boolean }[] = [
  { key: "rank", label: "Rank", sortable: true },
  { key: "coin", label: "币种" },
  { key: "price", label: "价格", align: "right", sortable: true },
  { key: "marketCap", label: "市值", align: "right", sortable: true },
  { key: "ytd", label: "YTD", align: "right", sortable: true },
  { key: "d7", label: "7D", align: "right", sortable: true },
  { key: "d30", label: "30D", align: "right", sortable: true },
  { key: "d90", label: "90D", align: "right", sortable: true },
  { key: "rsBtc", label: "RS BTC", align: "right", sortable: true },
  { key: "volume", label: "成交额", align: "right", sortable: true },
  { key: "volChange", label: "量变化", align: "right", sortable: true },
  { key: "holder", label: "Holder", align: "right", sortable: true },
  { key: "smartMoney", label: "Smart Money", align: "right", sortable: true },
  { key: "narrative", label: "叙事", align: "right", sortable: true },
  { key: "catalyst", label: "催化", align: "right", sortable: true },
  { key: "finalScore", label: "Score", align: "right", sortable: true },
  { key: "grade", label: "评级" },
];

function getSortValue(c: ScoredCoin, key: SortKey): number {
  switch (key) {
    case "rank": return c.rank;
    case "price": return c.price;
    case "marketCap": return c.marketCap;
    case "ytd": return c.returnsPct.ytd;
    case "d7": return c.returnsPct.d7;
    case "d30": return c.returnsPct.d30;
    case "d90": return c.returnsPct.d90;
    case "rsBtc": return c.rsBtc;
    case "volume": return c.volume24h;
    case "volChange": return c.volume.changePct;
    case "holder": return c.holder.d7;
    case "smartMoney": return c.smartMoney.netflow;
    case "narrative": return narrative100(c);
    case "catalyst": return catalyst100(c);
    case "finalScore": return c.finalScore;
  }
}

export function CoinTable({
  coins,
  maxRows,
  emptyText = "暂无符合条件的币种",
}: {
  coins: ScoredCoin[];
  maxRows?: number;
  emptyText?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("finalScore");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const favorites = useCryptoStore((s) => s.favorites);
  const toggleFavorite = useCryptoStore((s) => s.toggleFavorite);
  const removeCoin = useCryptoStore((s) => s.removeCoin);

  const sorted = useMemo(() => {
    const arr = [...coins];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortKey);
      const vb = getSortValue(b, sortKey);
      return dir === "asc" ? va - vb : vb - va;
    });
    return maxRows ? arr.slice(0, maxRows) : arr;
  }, [coins, sortKey, dir, maxRows]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-terminal-border bg-terminal-panel">
      <table className="quant-table w-full min-w-[1200px] text-[12px]">
        <thead>
          <tr className="text-left text-terminal-muted">
            {COLS.map((col) => {
              const k = col.key;
              const sortable = col.sortable && k !== "coin" && k !== "grade";
              const active = sortKey === k;
              return (
                <th
                  key={k}
                  onClick={() => sortable && onSort(k as SortKey)}
                  className={`px-2 py-2 font-medium ${col.align === "right" ? "text-right" : ""} ${sortable ? "cursor-pointer select-none hover:text-terminal-bright" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortable && (active ? (dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} />)}
                  </span>
                </th>
              );
            })}
            <th className="px-2 py-2 text-right" />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={COLS.length + 1} className="px-4 py-10 text-center text-terminal-muted">
                {emptyText}
              </td>
            </tr>
          )}
          {sorted.map((c) => {
            const fav = favorites.includes(c.id);
            return (
              <tr
                key={c.id}
                className="border-t border-terminal-border/60 transition-colors hover:bg-terminal-panel2"
              >
                <td className="px-2 py-1.5 tabular-nums text-terminal-muted">{c.rank}</td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(c.id)}
                      className={fav ? "text-amber-400" : "text-terminal-muted/50 hover:text-terminal-muted"}
                      title="收藏"
                    >
                      <Star size={13} fill={fav ? "currentColor" : "none"} />
                    </button>
                    <div className="min-w-0">
                      <Link
                        to={`/coin/${c.symbol}`}
                        className="font-semibold text-terminal-bright hover:text-emerald-400"
                      >
                        {c.symbol}
                      </Link>
                      <div className="truncate text-[10px] text-terminal-muted">{c.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{fmtPrice(c.price)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-terminal-fg">{fmtCompact(c.marketCap)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.returnsPct.ytd)}`}>{fmtPct(c.returnsPct.ytd)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.returnsPct.d7)}`}>{fmtPct(c.returnsPct.d7)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.returnsPct.d30)}`}>{fmtPct(c.returnsPct.d30)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.returnsPct.d90)}`}>{fmtPct(c.returnsPct.d90)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.rsBtc)}`}>{fmtPct(c.rsBtc, 0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-terminal-fg">{fmtCompact(c.volume24h)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.volume.changePct)}`}>{fmtPct(c.volume.changePct, 0)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.holder.d7)}`}>{fmtPct(c.holder.d7, 1)}</td>
                <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.smartMoney.netflow)}`}>{c.smartMoney.netflow.toFixed(0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-violet-400">{narrative100(c).toFixed(0)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-terminal-fg">{catalyst100(c).toFixed(0)}</td>
                <td className="px-2 py-1.5 text-right">
                  <span className="font-semibold tabular-nums text-terminal-bright">{fmtScore(c.finalScore)}</span>
                </td>
                <td className="px-2 py-1.5"><GradeBadge grade={c.grade} strong={c.strongC} /></td>
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => removeCoin(c.id)}
                    className="text-terminal-muted/50 hover:text-rose-400"
                    title="删除（可撤销）"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}