"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Search, Sparkles, ArrowUpRight, CornerDownLeft, Brain } from "lucide-react";
import { events, kols, projects } from "@/lib/data";
import { Panel } from "@/components/ui/Section";
import { ImportanceBadge, DirectionBadge } from "@/components/ui/Badges";
import { ScoreRing } from "@/components/ui/Gauge";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "今天ETH发生什么？",
  "最近谁预测最准？",
  "最近有哪些重大事件？",
  "BTC资金流情况",
  "哪些KOL在看多ETH",
  "Hyperliquid热度分析",
];

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(initial);

  useEffect(() => {
    if (initial) {
      setQ(initial);
      setSubmitted(initial);
      runSearch(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const runSearch = (query: string) => {
    setLoading(true);
    setSubmitted(query);
    setTimeout(() => setLoading(false), 700);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    runSearch(q);
  };

  const results = submitted ? computeResults(submitted) : null;

  return (
    <div className="space-y-5">
      {/* search bar */}
      <form onSubmit={onSubmit} className="relative">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-bg-panel p-3 shadow-panel focus-within:border-signal/40">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
            {loading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Search className="h-4 w-4" />}
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="用自然语言提问：今天ETH发生什么？"
            autoFocus
            className="flex-1 bg-transparent text-base text-ink placeholder:text-ink-low focus:outline-none"
          />
          <button type="submit" className="btn-primary h-9">
            <CornerDownLeft className="h-3.5 w-3.5" /> AI 解答
          </button>
        </div>
      </form>

      {!submitted && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQ(s); router.push(`/search?q=${encodeURIComponent(s)}`); runSearch(s); }}
              className="rounded-full border border-line bg-bg-elevated px-3 py-1.5 text-xs text-ink-mid transition-colors hover:border-signal/40 hover:text-signal"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <Panel className="p-6">
          <div className="flex items-center gap-3 text-signal">
            <Brain className="h-5 w-5 animate-pulse" />
            <span className="text-sm">AI 正在聚合事件、推文、KOL 与链上数据……</span>
          </div>
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-3 animate-pulse rounded bg-bg-elevated" style={{ width: `${90 - i * 15}%` }} />
            ))}
          </div>
        </Panel>
      )}

      {!loading && results && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* AI answer */}
          <Panel className="relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-signal/10 blur-[80px]" />
            <div className="relative">
              <div className="flex items-center gap-2">
                <span className="chip-signal"><Sparkles className="h-3 w-3" /> AI 回答</span>
                <span className="text-2xs text-ink-low">基于过去 24 小时数据</span>
              </div>
              <p className="mt-3 text-base leading-relaxed text-ink-high">{results.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {results.tags.map((t) => <span key={t} className="chip-signal text-[10px]">{t}</span>)}
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* events */}
            <ResultCol title="相关事件" count={results.events.length}>
              {results.events.map((e) => (
                <Link key={e.id} href={`/events/${e.id}`} className="group block rounded-lg border border-line bg-bg-base/40 p-3 transition-colors hover:border-signal/30">
                  <div className="flex items-center gap-2">
                    <ImportanceBadge importance={e.importance} />
                    <DirectionBadge direction={e.direction} />
                  </div>
                  <div className="mt-1.5 text-sm font-medium text-ink-high group-hover:text-signal">{e.title}</div>
                  <p className="mt-1 line-clamp-2 text-2xs text-ink-low">{e.aiAnalysis.oneLiner}</p>
                </Link>
              ))}
            </ResultCol>

            {/* kols */}
            <ResultCol title="相关 KOL" count={results.kols.length}>
              {results.kols.map((k) => (
                <Link key={k.id} href={`/kols/${k.id}`} className="group flex items-center gap-3 rounded-lg border border-line bg-bg-base/40 p-3 transition-colors hover:border-signal/30">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-bg-elevated font-display text-2xs font-bold text-signal">{k.avatar}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-high group-hover:text-signal">{k.name}</div>
                    <div className="truncate text-2xs text-ink-low">{k.recentView}</div>
                  </div>
                  <ScoreRing value={k.trustScore} size={36} stroke={3.5} color="#2EE6A6" />
                </Link>
              ))}
            </ResultCol>

            {/* projects */}
            <ResultCol title="相关项目" count={results.projects.length}>
              {results.projects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-bg-base/40 p-3">
                  <span className="chip-signal">{p.symbol}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink-high">{p.name}</div>
                    <div className="text-2xs text-ink-low">热度 {p.heat} · 24h {p.change24h >= 0 ? "+" : ""}{p.change24h}%</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-ink-low" />
                </div>
              ))}
            </ResultCol>

            {/* tweets */}
            <ResultCol title="相关推文" count={results.tweets.length}>
              {results.tweets.map((t, i) => (
                <div key={i} className="rounded-lg border border-line bg-bg-base/40 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-bg-elevated font-mono text-2xs text-signal">{t.author[0]}</div>
                    <span className="text-2xs font-medium text-ink-mid">{t.author}</span>
                    <span className="text-2xs text-ink-faint">{t.time}</span>
                    <span className={cn("ml-auto chip text-[9px]", t.sentiment === "bullish" ? "chip-bull" : t.sentiment === "bearish" ? "chip-bear" : "chip-warn")}>
                      {t.sentiment === "bullish" ? "看多" : t.sentiment === "bearish" ? "看空" : "中性"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-mid">{t.text}</p>
                </div>
              ))}
            </ResultCol>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ResultCol({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-ink-high">{title}</h3>
        <span className="text-2xs text-ink-low">{count} 条</span>
      </div>
      <div className="space-y-2">{children}</div>
    </Panel>
  );
}

function computeResults(q: string) {
  const ql = q.toLowerCase();
  const matchAsset = (kw: string) => ql.includes(kw.toLowerCase());

  let ev = events;
  let ks = kols;
  let ps = projects;

  if (matchAsset("eth") || matchAsset("以太")) {
    ev = events.filter((e) => e.assets.includes("ETH") || e.sectors.includes("ETH"));
    ks = kols.filter((k) => k.tags.some((t) => t.includes("ETH")) || k.handle.toLowerCase().includes("eth"));
    ps = projects.filter((p) => p.symbol === "ETH");
  } else if (matchAsset("btc") || matchAsset("比特币")) {
    ev = events.filter((e) => e.assets.includes("BTC"));
    ks = kols.filter((k) => k.tags.some((t) => t.includes("BTC") || t.includes("宏观") || t.includes("链上")));
    ps = projects.filter((p) => p.symbol === "BTC");
  } else if (matchAsset("hype") || matchAsset("hyperliquid")) {
    ev = events.filter((e) => e.assets.includes("HYPE"));
    ks = kols.slice(1, 4);
    ps = projects.filter((p) => p.symbol === "HYPE");
  } else if (matchAsset("预测") || matchAsset("谁最准") || matchAsset("准确")) {
    ev = events.slice(0, 3);
    ks = [...kols].sort((a, b) => b.hitRate - a.hitRate).slice(0, 4);
    ps = projects.slice(0, 3);
  } else if (matchAsset("资金") || matchAsset("流")) {
    ev = events.filter((e) => e.id === "evt-2" || e.id === "evt-1");
    ks = kols.filter((k) => k.tags.some((t) => t.includes("资金") || t.includes("链上")));
    ps = projects.slice(0, 3);
  } else if (matchAsset("事件") || matchAsset("重大")) {
    ev = [...events].sort((a, b) => b.importanceScore - a.importanceScore).slice(0, 4);
    ks = kols.slice(0, 3);
    ps = projects.slice(0, 3);
  }

  if (ev.length === 0) ev = events.slice(0, 2);
  if (ks.length === 0) ks = kols.slice(0, 3);
  if (ps.length === 0) ps = projects.slice(0, 3);

  const summary = buildSummary(q, ev, ks, ps);

  const tweets = ks.slice(0, 4).map((k, i) => ({
    author: k.name,
    time: `${i + 1}小时前`,
    sentiment: k.bullRatio > 60 ? "bullish" : k.bearRatio > 50 ? "bearish" : "neutral",
    text: k.recentView,
  }));

  const tags = Array.from(new Set([...ev.flatMap((e) => e.assets), ...ev.flatMap((e) => e.sectors)])).slice(0, 6);

  return { summary, events: ev.slice(0, 3), kols: ks.slice(0, 3), projects: ps.slice(0, 3), tweets, tags };
}

function buildSummary(q: string, ev: typeof events, ks: typeof kols, ps: typeof projects) {
  const asset = ps[0]?.symbol ?? "市场";
  const topEvent = ev[0];
  const topKol = ks[0];
  const lines: string[] = [];

  if (q.includes("ETH") || q.includes("eth") || q.includes("以太")) {
    lines.push(`过去 24 小时 ETH 的核心驱动是「${topEvent?.title ?? "ETH 现货 ETF 资金流入创近两月新高"}」。`);
    lines.push(`AI 评分 ${topEvent?.importanceScore ?? 92}（${topEvent?.importance ?? "Critical"}），情绪偏多，24h 收益 +${ev[0]?.outcome["24h"] ?? 4.1}%。`);
    lines.push(`${ks.length} 位高可信 KOL 共振看多，其中 ${topKol?.name}（Trust ${topKol?.trustScore}）观点最具参考性。`);
    lines.push(`建议关注 ETF 资金连续性与 3650–3700 突破有效性，警惕前高假突破风险。`);
  } else if (q.includes("预测") || q.includes("准确") || q.includes("谁")) {
    lines.push(`近 30 天预测命中率最高的 KOL 是 ${topKol?.name}（命中率 ${topKol?.hitRate}%，Trust ${topKol?.trustScore}）。`);
    lines.push(`其代表作 ${topKol?.topCall?.asset} 累计收益 ${topKol?.topCall && topKol.topCall.return >= 0 ? "+" : ""}${topKol?.topCall?.return}%，观点以 ${topKol && topKol.bullRatio > 50 ? "看多" : "看空"} 为主。`);
    lines.push(`可结合其最新观点「${topKol?.recentView}」与链上信号交叉验证。`);
  } else {
    lines.push(`过去 24 小时最重要的 ${ev.length} 个事件中，「${topEvent?.title}」AI 评分最高（${topEvent?.importanceScore}）。`);
    lines.push(`方向判定为${topEvent?.direction === "bullish" ? "看多" : topEvent?.direction === "bearish" ? "看空" : "中性"}，相关标的 ${ev[0]?.assets.join("、") ?? asset}。`);
    lines.push(`${ks.length} 位 KOL 参与，${topKol?.name} 的影响力与可信度最高。`);
    lines.push(`建议持续追踪事件 7d / 30d 结果兑现情况。`);
  }
  return lines.join(" ");
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-sm text-ink-low">加载中…</div>}>
      <SearchInner />
    </Suspense>
  );
}
