// =============================================================
// TOP 20 —— 当前市场最值得关注的 20 个币
// 展示每个币的核心指标 + 入选理由 + 跌出条件
// =============================================================
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Trophy, ArrowUpRight } from "lucide-react";
import { useCryptoStore } from "../store";
import { Panel, Badge } from "../components/ui";
import { GradeBadge, TrendBadge, MoneyFlowBadge } from "../components/GradeBadge";
import { fmtPct, fmtScore, fmtTime, colorBy } from "../lib/utils/format";
import { narrative100 } from "../lib/scoring/narrative";
import { catalyst100 } from "../lib/scoring/catalyst";
import { NARRATIVE_LABELS } from "../lib/config/narratives";
import type { ScoredCoin } from "../lib/types";

export default function Top20() {
  const coins = useCryptoStore((s) => s.coins);
  const snapshot = useCryptoStore((s) => s.snapshot);

  const top20 = useMemo(
    () => [...coins].sort((a, b) => b.finalScore - a.finalScore).slice(0, 20),
    [coins],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy size={18} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-terminal-bright">Top 20 · 最值得关注</h2>
        {snapshot && (
          <span className="text-[11px] text-terminal-muted">
            数据更新 {fmtTime(snapshot.dataUpdatedAt)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {top20.map((c, i) => (
          <Top20Card key={c.id} coin={c} index={i + 1} />
        ))}
      </div>
    </div>
  );
}

function Top20Card({ coin, index }: { coin: ScoredCoin; index: number }) {
  const c = coin;
  const drop = dropConditions(c);
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold tabular-nums text-terminal-muted">#{index}</span>
            <Link to={`/coin/${c.symbol}`} className="inline-flex items-center gap-1 text-[16px] font-semibold text-terminal-bright hover:text-emerald-400">
              {c.symbol} <ArrowUpRight size={14} />
            </Link>
            <GradeBadge grade={c.grade} />
            <span className="text-[11px] text-terminal-muted">{c.name}</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
            <KV label="Score" v={<span className="font-semibold tabular-nums text-terminal-bright">{fmtScore(c.finalScore)}</span>} />
            <KV label="趋势" v={<TrendBadge trend={c.trend} />} />
            <KV label="RS BTC" v={<span className={colorBy(c.rsBtc)}>{fmtPct(c.rsBtc)}</span>} />
            <KV label="量变化" v={<span className={colorBy(c.volume.changePct)}>{fmtPct(c.volume.changePct, 0)}</span>} />
            <KV label="Holder 7D" v={<span className={colorBy(c.holder.d7)}>{fmtPct(c.holder.d7, 1)}</span>} />
            <KV label="资金" v={<MoneyFlowBadge flow={c.moneyFlow} />} />
            <KV label="叙事" v={<span className="tabular-nums text-violet-400">{narrative100(c).toFixed(0)}</span>} />
            <KV label="催化" v={<span className="tabular-nums">{catalyst100(c).toFixed(0)}</span>} />
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {c.narrative.tags.map((t) => (
          <Badge key={t} tone="violet">{NARRATIVE_LABELS[t]}</Badge>
        ))}
        {c.isMeme && <Badge tone="amber">Meme</Badge>}
        {c.isRobinhood && <Badge tone="cyan">Robinhood</Badge>}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 border-t border-terminal-border pt-3 text-[12px] sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-400">为什么进入 Top 20</div>
          <ul className="space-y-0.5 text-terminal-fg">
            {c.summary.whyStrong.slice(0, 4).map((s, i) => (
              <li key={i} className="flex gap-1"><span className="text-emerald-400">+</span>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-rose-400">什么情况下跌出</div>
          <ul className="space-y-0.5 text-terminal-muted">
            {drop.map((s, i) => (
              <li key={i} className="flex gap-1"><span className="text-rose-400">−</span>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/** 由数据推导「跌出 Top 20」条件 */
function dropConditions(c: ScoredCoin): string[] {
  const out: string[] = [];
  if (c.rsBtc < 10) out.push("RS vs BTC 走弱至 < +10%");
  if (c.volume.changePct < 30) out.push("成交量放大降至 < +30%");
  if (c.holder.d7 < 3) out.push("Holder 增长 < 3%");
  if (c.smartMoney.netflow < 5) out.push("Smart Money 转弱或流出");
  if (narrative100(c) < 60) out.push("叙事热度降温（< 60）");
  if (catalyst100(c) < 40) out.push("催化剂兑现 / 新催化缺位");
  if (c.finalScore < 70) out.push("综合评分跌破 70");
  if (out.length === 0) out.push("跌破 MA20 且放量下跌");
  return out.slice(0, 4);
}

function KV({ label, v }: { label: string; v: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-terminal-muted">{label}</span>
      <span>{v}</span>
    </div>
  );
}