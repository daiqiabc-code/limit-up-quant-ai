// =============================================================
// Dashboard —— 首页量化终端
// 第一屏：Market 概览 → Today's Top 20 → Recovery → Remove
// =============================================================
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  TrendingUp,
  Trash2,
  Activity,
  ArrowRight,
} from "lucide-react";
import { useCryptoStore } from "../store";
import { StatCard, Panel, RiskGauge, ScoreBar, Badge } from "../components/ui";
import { TrendBadge } from "../components/GradeBadge";
import { CoinTable } from "../components/CoinTable";
import { fmtCompact, fmtPct, fmtTime, colorBy, fmtScore } from "../lib/utils/format";

export default function Dashboard() {
  const coins = useCryptoStore((s) => s.coins);
  const snapshot = useCryptoStore((s) => s.snapshot);

  const top20 = useMemo(
    () => coins.filter((c) => !c.removedToday).sort((a, b) => b.finalScore - a.finalScore).slice(0, 20),
    [coins],
  );
  const recovery = useMemo(
    () => coins.filter((c) => c.isRecovery).sort((a, b) => b.finalScore - a.finalScore).slice(0, 8),
    [coins],
  );
  const removed = useMemo(
    () => coins.filter((c) => c.grade === "C" && (c.strongC || c.killCount >= 4))
      .sort((a, b) => a.finalScore - b.finalScore).slice(0, 8),
    [coins],
  );

  if (!snapshot) return null;

  return (
    <div className="space-y-4">
      {/* ---------- 顶部 KPI ---------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <StatCard label="扫描币种" value={snapshot.totalCoins} accent="text-terminal-bright" />
        <StatCard label="S 级" value={snapshot.gradeCounts.S} accent="text-violet-400" sub="必须盯" />
        <StatCard label="A 级" value={snapshot.gradeCounts.A} accent="text-blue-400" sub="值得跟踪" />
        <StatCard label="B 级" value={snapshot.gradeCounts.B} accent="text-cyan-400" sub="事件驱动" />
        <StatCard label="C 级" value={snapshot.gradeCounts.C} accent="text-slate-400" sub="删除池" />
        <StatCard label="今日新增" value={snapshot.addedToday} accent="text-emerald-400" sub="强势币" />
        <StatCard label="今日掉出" value={snapshot.removedToday} accent="text-rose-400" sub="自选清除" />
        <div className="col-span-2 sm:col-span-1">
          <div className="flex h-full items-center justify-center rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2.5">
            <RiskGauge score={snapshot.riskScore} />
          </div>
        </div>
      </div>

      {/* ---------- Market 概览 ---------- */}
      <Panel title="Market">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <MarketItem label="BTC 趋势" value={<TrendBadge trend={snapshot.btcTrend} />} />
          <MarketItem label="ETH 趋势" value={<TrendBadge trend={snapshot.ethTrend} />} />
          <MarketItem label="总市值" value={<span className="tabular-nums text-terminal-bright">{fmtCompact(snapshot.totalMarketCap)}</span>} />
          <MarketItem label="BTC Dominance" value={<span className="tabular-nums text-terminal-bright">{snapshot.btcDominance.toFixed(1)}%</span>} />
          <MarketItem
            label="市场广度"
            value={
              <div className="w-full">
                <div className="mb-1 tabular-nums text-terminal-bright">{snapshot.marketBreadth.toFixed(0)}% 上涨</div>
                <ScoreBar value={snapshot.marketBreadth} max={100} />
              </div>
            }
          />
          <MarketItem
            label="Risk Score"
            value={
              <div className="w-full">
                <div className={`mb-1 tabular-nums ${snapshot.riskScore >= 70 ? "text-rose-400" : snapshot.riskScore >= 40 ? "text-amber-400" : "text-emerald-400"}`}>
                  {snapshot.riskScore.toFixed(0)} / 100
                </div>
                <ScoreBar value={snapshot.riskScore} max={100} />
              </div>
            }
          />
        </div>
      </Panel>

      {/* ---------- Today's Top 20 ---------- */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Trophy size={15} className="text-amber-400" /> 今日 Top 20
          </span>
        }
        right={
          <Link to="/top20" className="inline-flex items-center gap-1 text-[12px] text-terminal-muted hover:text-terminal-bright">
            全部 <ArrowRight size={13} />
          </Link>
        }
      >
        <CoinTable coins={top20} maxRows={20} emptyText="暂无强势币" />
      </Panel>

      {/* ---------- Recovery 反转观察区 ---------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <TrendingUp size={15} className="text-emerald-400" /> 反转观察区 Recovery
            </span>
          }
          right={
            <Badge tone="green">{recovery.length} 个由弱转强</Badge>
          }
        >
          {recovery.length === 0 ? (
            <Empty text="暂无反转币种" />
          ) : (
            <div className="space-y-2">
              {recovery.map((c) => (
                <RecoveryRow key={c.id} symbol={c.symbol} name={c.name} d7={c.returnsPct.d7} d30={c.returnsPct.d30} volume={c.volume.changePct} holder={c.holder.d7} netflow={c.smartMoney.netflow} score={c.finalScore} />
              ))}
            </div>
          )}
        </Panel>

        {/* ---------- Remove 删除池 ---------- */}
        <Panel
          title={
            <span className="inline-flex items-center gap-2">
              <Trash2 size={15} className="text-rose-400" /> 建议删除 Remove
            </span>
          }
          right={
            <Link to="/remove" className="inline-flex items-center gap-1 text-[12px] text-terminal-muted hover:text-terminal-bright">
              全部 <ArrowRight size={13} />
            </Link>
          }
        >
          {removed.length === 0 ? (
            <Empty text="暂无删除信号" />
          ) : (
            <div className="space-y-2">
              {removed.map((c) => (
                <RemoveRow key={c.id} symbol={c.symbol} name={c.name} score={c.finalScore} reasons={c.removeReasons.slice(0, 3)} strong={c.strongC} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* 数据更新时间 */}
      <Footer source={snapshot.dataSource} isDemo={snapshot.isDemo} updatedAt={snapshot.dataUpdatedAt} />
    </div>
  );
}

function MarketItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-terminal-border/60 bg-terminal-panel2 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-terminal-muted">{label}</div>
      <div className="mt-1 text-[13px]">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="py-8 text-center text-[12px] text-terminal-muted">{text}</div>;
}

function RecoveryRow(p: { symbol: string; name: string; d7: number; d30: number; volume: number; holder: number; netflow: number; score: number }) {
  return (
    <Link
      to={`/coin/${p.symbol}`}
      className="flex items-center justify-between gap-3 rounded-md border border-terminal-border/60 px-3 py-2 transition-colors hover:bg-terminal-panel2"
    >
      <div className="min-w-0">
        <div className="font-semibold text-terminal-bright">{p.symbol} <span className="text-[10px] font-normal text-terminal-muted">{p.name}</span></div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          <span className={colorBy(p.d7)}>7D {fmtPct(p.d7)}</span>
          <span className={colorBy(p.d30)}>30D {fmtPct(p.d30)}</span>
          <span className={colorBy(p.volume)}>量 {fmtPct(p.volume, 0)}</span>
          <span className={colorBy(p.holder)}>Holder {fmtPct(p.holder, 1)}</span>
          <span className={colorBy(p.netflow)}>SM {p.netflow.toFixed(0)}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-semibold tabular-nums text-terminal-bright">{fmtScore(p.score)}</div>
        <Badge tone="green">反转</Badge>
      </div>
    </Link>
  );
}

function RemoveRow(p: { symbol: string; name: string; score: number; reasons: string[]; strong: boolean }) {
  return (
    <Link
      to={`/coin/${p.symbol}`}
      className="flex items-center justify-between gap-3 rounded-md border border-terminal-border/60 px-3 py-2 transition-colors hover:bg-terminal-panel2"
    >
      <div className="min-w-0">
        <div className="font-semibold text-terminal-bright">{p.symbol} <span className="text-[10px] font-normal text-terminal-muted">{p.name}</span></div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-terminal-muted">
          {p.reasons.map((r, i) => (
            <span key={i} className="text-rose-400/80">{r}</span>
          ))}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15px] font-semibold tabular-nums text-rose-400">{fmtScore(p.score)}</div>
        <Badge tone="red">{p.strong ? "Strong C" : "C"}</Badge>
      </div>
    </Link>
  );
}

function Footer({ source, isDemo, updatedAt }: { source: string; isDemo: boolean; updatedAt: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-terminal-muted">
      <Activity size={12} />
      <span>数据源：{source}</span>
      <span>·</span>
      <span>{isDemo ? "Demo 数据 / 模拟" : "实时"}</span>
      <span>·</span>
      <span>更新于 {fmtTime(updatedAt)}</span>
    </div>
  );
}