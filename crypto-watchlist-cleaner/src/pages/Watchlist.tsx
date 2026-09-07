// =============================================================
// Watchlist —— My Watchlist
// 分类：Core / Swing / Meme / New Narrative / Robinhood
// =============================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Star, Plus, X } from "lucide-react";
import { useCryptoStore, WATCH_CATEGORIES, type WatchCategory } from "../store";
import { Panel, Badge } from "../components/ui";
import { GradeBadge } from "../components/GradeBadge";
import { fmtScore, colorBy, fmtPct } from "../lib/utils/format";
import type { ScoredCoin } from "../lib/types";

export default function Watchlist() {
  const coins = useCryptoStore((s) => s.coins);
  const watchlist = useCryptoStore((s) => s.watchlist);
  const setWatchCategory = useCryptoStore((s) => s.setWatchCategory);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<WatchCategory>("Core");
  const [adding, setAdding] = useState(false);

  const matches = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return coins
      .filter((c) => c.symbol.toLowerCase().includes(kw) || c.name.toLowerCase().includes(kw))
      .filter((c) => !watchlist[c.id])
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 12);
  }, [coins, q, watchlist]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Star size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-terminal-bright">My Watchlist</h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-terminal-border px-2.5 py-1.5 text-[12px] text-terminal-muted hover:text-terminal-bright"
        >
          <Plus size={14} /> 添加币种
        </button>
      </div>

      {adding && (
        <Panel title="添加币种">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索币种代号 / 名称"
              className="w-64 rounded-md border border-terminal-border bg-terminal-panel px-3 py-1.5 text-[13px] text-terminal-bright outline-none focus:border-emerald-500/50"
            />
            {WATCH_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCat(c.value)}
                className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                  cat === c.value
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                    : "border-terminal-border text-terminal-muted"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          {matches.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {matches.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setWatchCategory(c.id, cat);
                    setQ("");
                  }}
                  className="flex items-center justify-between rounded-md border border-terminal-border/60 px-3 py-2 text-left transition-colors hover:bg-terminal-panel2"
                >
                  <span>
                    <span className="font-semibold text-terminal-bright">{c.symbol}</span>
                    <span className="ml-2 text-[10px] text-terminal-muted">{c.name}</span>
                  </span>
                  <span className="text-[12px] tabular-nums text-terminal-muted">{fmtScore(c.finalScore)}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      <div className="space-y-3">
        {WATCH_CATEGORIES.map((catItem) => {
          const list = coins.filter((c) => watchlist[c.id] === catItem.value);
          return (
            <WatchSection
              key={catItem.value}
              label={catItem.label}
              coins={list.sort((a, b) => b.finalScore - a.finalScore)}
              onRemove={(id) => setWatchCategory(id, null)}
            />
          );
        })}
      </div>
    </div>
  );
}

function WatchSection({
  label,
  coins,
  onRemove,
}: {
  label: string;
  coins: ScoredCoin[];
  onRemove: (id: string) => void;
}) {
  return (
    <Panel
      title={label}
      right={<span className="text-[11px] text-terminal-muted">{coins.length} 个</span>}
    >
      {coins.length === 0 ? (
        <div className="py-6 text-center text-[12px] text-terminal-muted">该分类暂无币种</div>
      ) : (
        <div className="divide-y divide-terminal-border/60">
          {coins.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link to={`/coin/${c.symbol}`} className="font-semibold text-terminal-bright hover:text-emerald-400">
                  {c.symbol}
                </Link>
                <span className="truncate text-[10px] text-terminal-muted">{c.name}</span>
                <GradeBadge grade={c.grade} strong={c.strongC} />
                {c.isMeme && <Badge tone="amber">Meme</Badge>}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="hidden items-center gap-4 text-[12px] tabular-nums sm:flex">
                  <span className={colorBy(c.returnsPct.d7)}>{fmtPct(c.returnsPct.d7)}</span>
                  <span className={colorBy(c.rsBtc)}>{fmtPct(c.rsBtc, 0)}</span>
                  <span className="font-semibold text-terminal-bright">{fmtScore(c.finalScore)}</span>
                </div>
                <button
                  onClick={() => onRemove(c.id)}
                  className="text-terminal-muted/50 hover:text-rose-400"
                  title="移出自选"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}