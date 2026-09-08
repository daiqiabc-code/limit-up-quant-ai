// =============================================================
// 币种详情 —— AI 摘要 + 因子拆解 + Meme/Robinhood + 操作
// =============================================================
import { useMemo, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Star, Trash2, Undo2, X } from "lucide-react";
import { useCryptoStore, WATCH_CATEGORIES } from "../store";
import { analyzeCoin } from "../lib/ai/analyze";
import { isAiConfigured } from "../lib/ai/client";
import { Panel, Badge, ScoreBar } from "../components/ui";
import { GradeBadge, TrendBadge, MoneyFlowBadge } from "../components/GradeBadge";
import { fmtPrice, fmtCompact, fmtPct, fmtScore, fmtTime, colorBy } from "../lib/utils/format";
import { FACTOR_MAX } from "../lib/config/weights";
import { NARRATIVE_LABELS, ROBINHOOD_STAGE_LABELS } from "../lib/config/narratives";
import type { ScoredCoin } from "../lib/types";

const RECO_LABEL = { KEEP: "KEEP 保留", WATCH: "WATCH 观察", REMOVE: "REMOVE 删除" } as const;
const RECO_TONE = { KEEP: "green", WATCH: "amber", REMOVE: "red" } as const;

const FACTORS: { key: keyof ScoredCoin["scores"]; label: string }[] = [
  { key: "priceStrength", label: "Price Strength" },
  { key: "volume", label: "Volume / Liquidity" },
  { key: "holder", label: "Holder Growth" },
  { key: "smartMoney", label: "Smart Money" },
  { key: "narrative", label: "Narrative" },
  { key: "attention", label: "Market Attention" },
  { key: "catalyst", label: "Catalyst" },
];

export default function CoinDetail() {
  const { symbol } = useParams();
  const coins = useCryptoStore((s) => s.coins);
  const snapshot = useCryptoStore((s) => s.snapshot);

  const coin = useMemo(
    () => coins.find((c) => c.symbol.toLowerCase() === (symbol ?? "").toLowerCase()),
    [coins, symbol],
  );

  if (!coin) {
    return (
      <div className="py-16 text-center">
        <div className="text-terminal-muted">未找到币种 {symbol}</div>
        <Link to="/market" className="mt-4 inline-block text-emerald-400 hover:underline">返回全市场</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/market" className="text-terminal-muted hover:text-terminal-bright"><ArrowLeft size={16} /></Link>
        <h2 className="text-lg font-semibold text-terminal-bright">{coin.symbol}</h2>
        <span className="text-[12px] text-terminal-muted">{coin.name}</span>
        <GradeBadge grade={coin.grade} strong={coin.strongC} />
        <span className="ml-auto text-[11px] text-terminal-muted">
          {snapshot?.isDemo ? "Demo 数据" : snapshot?.dataSource} · 更新 {fmtTime(snapshot?.dataUpdatedAt ?? new Date().toISOString())}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 左：核心指标 + 因子 */}
        <div className="space-y-4 lg:col-span-2">
          <Panel>
            <HeaderMetrics coin={coin} />
          </Panel>

          <Panel title={`因子拆解 · 总分 ${fmtScore(coin.finalScore)} / 100`}>
            <div className="space-y-2">
              {FACTORS.map((f) => (
                <div key={f.key} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 text-[12px] text-terminal-muted">{f.label}</div>
                  <div className="flex-1"><ScoreBar value={coin.scores[f.key]} max={FACTOR_MAX[f.key]} /></div>
                  <div className="w-16 shrink-0 text-right text-[12px] tabular-nums text-terminal-fg">
                    {coin.scores[f.key].toFixed(1)}<span className="text-terminal-muted">/{FACTOR_MAX[f.key]}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 border-t border-terminal-border pt-2">
                <div className="w-36 shrink-0 text-[12px] text-rose-400">惩罚 Penalty</div>
                <div className="flex-1" />
                <div className="w-16 shrink-0 text-right text-[12px] tabular-nums text-rose-400">{coin.penalty.toFixed(1)}</div>
              </div>
            </div>
          </Panel>

          <AI coin={coin} />
        </div>

        {/* 右：叙事 / 催化 / Meme / 操作 */}
        <div className="space-y-4">
          <InfoPanel coin={coin} />
          {coin.isMeme && <MemePanel coin={coin} />}
          <ActionPanel coin={coin} />
        </div>
      </div>
    </div>
  );
}

function HeaderMetrics({ coin }: { coin: ScoredCoin }) {
  const c = coin;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-3">
      <M label="价格" v={<span className="tabular-nums text-terminal-bright">{fmtPrice(c.price)}</span>} />
      <M label="市值" v={<span className="tabular-nums">{fmtCompact(c.marketCap)}</span>} />
      <M label="FDV" v={<span className="tabular-nums">{fmtCompact(c.fdv)}</span>} />
      <M label="24H" v={<span className={colorBy(c.returnsPct.d1)}>{fmtPct(c.returnsPct.d1)}</span>} />
      <M label="7D" v={<span className={colorBy(c.returnsPct.d7)}>{fmtPct(c.returnsPct.d7)}</span>} />
      <M label="30D" v={<span className={colorBy(c.returnsPct.d30)}>{fmtPct(c.returnsPct.d30)}</span>} />
      <M label="90D" v={<span className={colorBy(c.returnsPct.d90)}>{fmtPct(c.returnsPct.d90)}</span>} />
      <M label="YTD" v={<span className={colorBy(c.returnsPct.ytd)}>{fmtPct(c.returnsPct.ytd)}</span>} />
      <M label="RS vs BTC" v={<span className={colorBy(c.rsBtc)}>{fmtPct(c.rsBtc)}</span>} />
      <M label="24H 成交额" v={<span className="tabular-nums">{fmtCompact(c.volume24h)}</span>} />
      <M label="量变化" v={<span className={colorBy(c.volume.changePct)}>{fmtPct(c.volume.changePct, 0)}</span>} />
      <M label="成交额/市值" v={<span className="tabular-nums">{(c.volume.volToMc * 100).toFixed(1)}%</span>} />
    </div>
  );
}

function M({ label, v }: { label: string; v: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-terminal-muted">{label}</div>
      <div className="mt-0.5">{v}</div>
    </div>
  );
}

function AI({ coin }: { coin: ScoredCoin }) {
  const s = coin.summary;
  const aiReady = isAiConfigured();
  const [deep, setDeep] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runDeep = async () => {
    if (busy) return;
    setBusy(true);
    const text = await analyzeCoin(coin);
    setDeep(text || "AI 分析暂不可用，请检查 VITE_AI_API_URL 配置。");
    setBusy(false);
  };

  return (
    <Panel
      title="AI 分析"
      right={<Badge tone={RECO_TONE[s.recommendation]}>{RECO_LABEL[s.recommendation]}</Badge>}
    >
      <div className="grid grid-cols-1 gap-3 text-[12px] sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-400">为什么强？</div>
          <ul className="space-y-0.5 text-terminal-fg">
            {s.whyStrong.map((x, i) => <li key={i} className="flex gap-1"><span className="text-emerald-400">+</span>{x}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[11px] uppercase tracking-wide text-rose-400">为什么弱？</div>
          <ul className="space-y-0.5 text-terminal-fg">
            {s.whyWeak.map((x, i) => <li key={i} className="flex gap-1"><span className="text-rose-400">−</span>{x}</li>)}
          </ul>
        </div>
        <div className="sm:col-span-2 grid grid-cols-1 gap-2 rounded-md border border-terminal-border/60 bg-terminal-panel2 p-3 sm:grid-cols-2">
          <S label="当前阶段" v={s.stage} />
          <S label="资金流向" v={s.moneyFlow} />
          <S label="最大风险" v={s.risk} />
          <S label="是否值得自选" v={s.worthAdding ? "是" : "否"} />
        </div>
      </div>

      <div className="mt-3 border-t border-terminal-border/60 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-violet-400">AI 深度分析</span>
          <button
            onClick={runDeep}
            disabled={busy || !aiReady}
            className="rounded border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-300 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "分析中…" : "生成深度分析"}
          </button>
        </div>
        {deep ? (
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-terminal-fg">{deep}</p>
        ) : aiReady ? (
          <p className="text-[12px] text-terminal-muted">点击「生成深度分析」，让 LLM 结合实时指标给出结论。</p>
        ) : (
          <p className="text-[12px] text-terminal-muted">未配置 VITE_AI_API_URL，当前为规则引擎摘要。</p>
        )}
      </div>
    </Panel>
  );
}

function S({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <div className="text-[11px] text-terminal-muted">{label}</div>
      <div className="text-terminal-bright">{v}</div>
    </div>
  );
}

function InfoPanel({ coin }: { coin: ScoredCoin }) {
  return (
    <Panel title="赛道 · 催化 · 信号">
      <div className="space-y-3 text-[12px]">
        <div>
          <div className="mb-1 text-[11px] text-terminal-muted">链 · 上市天数</div>
          <div className="flex flex-wrap items-center gap-2 text-terminal-fg">
            <Badge tone="slate">{coin.chain}</Badge>
            <span className="text-terminal-muted">{coin.listedDays} 天</span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-terminal-muted">叙事</div>
          <div className="flex flex-wrap gap-1">
            {coin.narrative.tags.map((t) => <Badge key={t} tone="violet">{NARRATIVE_LABELS[t]}</Badge>)}
            <span className="text-[11px] text-terminal-muted">新鲜度 {coin.narrative.freshness.toFixed(0)}</span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[11px] text-terminal-muted">催化事件</div>
          {coin.catalyst.events.length === 0 ? (
            <span className="text-terminal-muted">无</span>
          ) : (
            <ul className="space-y-1">
              {coin.catalyst.events.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Badge tone="cyan">{e.horizon} 天</Badge>
                  <span className="text-terminal-fg">{e.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 text-[11px] text-terminal-muted">趋势 / 资金</div>
          <div className="flex items-center gap-2">
            <TrendBadge trend={coin.trend} />
            <MoneyFlowBadge flow={coin.moneyFlow} />
            {coin.isRecovery && <Badge tone="green">Recovery</Badge>}
            {coin.isSCandidate && <Badge tone="violet">S 候选</Badge>}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function MemePanel({ coin }: { coin: ScoredCoin }) {
  const m = coin.meme;
  if (!m) return null;
  const rows: [string, string][] = [
    ["Meme Score", fmtScore(coin.memeScore ?? 0)],
    ["Robinhood 阶段", coin.robinhoodStage ? ROBINHOOD_STAGE_LABELS[coin.robinhoodStage] : "—"],
    ["LP 规模", fmtCompact(m.lpSize)],
    ["LP 变化", fmtPct(m.lpChangePct, 0)],
    ["捆绑钱包", `${m.bundledWalletsPct.toFixed(0)}%`],
    ["开发者持仓", `${m.devHoldingPct.toFixed(0)}%`],
    ["开发者抛售", `${m.devSellingPct.toFixed(0)}%`],
    ["Top10 集中度", `${m.top10ConcentrationPct.toFixed(0)}%`],
    ["狙击手占比", `${m.sniperPct.toFixed(0)}%`],
    ["新钱包占比", `${m.freshWalletPct.toFixed(0)}%`],
    ["社交加速度", fmtPct(m.socialAcceleration, 0)],
    ["X 提及量", m.xMentions.toLocaleString("en-US")],
  ];
  return (
    <Panel title="Meme 专用模型">
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between rounded border border-terminal-border/60 px-2 py-1.5">
            <span className="text-terminal-muted">{k}</span>
            <span className="text-terminal-bright">{v}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ActionPanel({ coin }: { coin: ScoredCoin }) {
  const favorites = useCryptoStore((s) => s.favorites);
  const toggleFavorite = useCryptoStore((s) => s.toggleFavorite);
  const watchlist = useCryptoStore((s) => s.watchlist);
  const setWatchCategory = useCryptoStore((s) => s.setWatchCategory);
  const removed = useCryptoStore((s) => s.removed);
  const removeCoin = useCryptoStore((s) => s.removeCoin);
  const restoreCoin = useCryptoStore((s) => s.restoreCoin);

  const fav = favorites.includes(coin.id);
  const watchCat = watchlist[coin.id];
  const isRemoved = !!removed[coin.id];

  return (
    <Panel title="操作">
      <div className="space-y-2">
        <button
          onClick={() => toggleFavorite(coin.id)}
          className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-[13px] ${
            fav ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-terminal-border text-terminal-muted hover:text-terminal-bright"
          }`}
        >
          <Star size={14} fill={fav ? "currentColor" : "none"} /> {fav ? "已收藏" : "收藏"}
        </button>

        <div>
          <div className="mb-1 text-[11px] text-terminal-muted">加入自选分类</div>
          <div className="flex flex-wrap gap-1">
            {WATCH_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setWatchCategory(coin.id, c.value)}
                className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                  watchCat === c.value
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                    : "border-terminal-border text-terminal-muted hover:text-terminal-fg"
                }`}
              >
                {c.label}
              </button>
            ))}
            {watchCat && (
              <button onClick={() => setWatchCategory(coin.id, null)} className="rounded border border-terminal-border px-2 py-1 text-[11px] text-rose-400">
                <span className="inline-flex items-center gap-1"><X size={11} /> 移除</span>
              </button>
            )}
          </div>
        </div>

        {isRemoved ? (
          <button
            onClick={() => restoreCoin(coin.id)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-400"
          >
            <Undo2 size={14} /> 撤销删除
          </button>
        ) : (
          <button
            onClick={() => removeCoin(coin.id)}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-400"
          >
            <Trash2 size={14} /> 从自选删除
          </button>
        )}
      </div>
    </Panel>
  );
}