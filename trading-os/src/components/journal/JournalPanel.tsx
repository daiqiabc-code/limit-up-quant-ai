"use client";

import { useState } from "react";
import { useTradingStore } from "@/store/tradingStore";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { REGIME_LABEL_ZH, regimeTone, SIDE_LABEL, SETUP_LABEL } from "@/lib/labels";
import { formatUsd, formatPrice, cn } from "@/lib/utils";
import type { Trade, MistakeType, RegimeState, SetupType, Side } from "@/types";
import { Plus, X, Pencil } from "lucide-react";

const MISTAKES: { v: MistakeType; label: string }[] = [
  { v: "NONE", label: "无" },
  { v: "FOMO", label: "冲动入场" },
  { v: "EARLY_ENTRY", label: "提前入场" },
  { v: "LATE_ENTRY", label: "延迟入场" },
  { v: "OVERSIZING", label: "仓位过大" },
  { v: "NO_STOP", label: "未设止损" },
  { v: "EARLY_EXIT", label: "过早离场" },
  { v: "REVENGE_TRADE", label: "报复性交易" },
  { v: "OVERTRADE", label: "过度交易" },
  { v: "RULE_VIOLATION", label: "违反规则" },
];

const DEFAULT_TRADES: Trade[] = [
  {
    id: "t-1", symbol: "BTCUSDT", side: "LONG", entry: 100200, exit: 103500, stop: 99000, target: 104000,
    sizeUsd: 5000, leverage: 5, regime: "BULL_TREND", setup: "PULLBACK", signalScore: 92,
    entryReason: "回踩 MA80 后重启，多头结构完整", exitReason: "到达目标位", result: 1250, rMultiple: 2.8,
    mistake: "NONE", tags: ["纪律", "A+"], notes: "标准回踩入场", openedAt: Date.now() - 86400e3 * 3, closedAt: Date.now() - 86400e3 * 2,
  },
  {
    id: "t-2", symbol: "ETHUSDT", side: "LONG", entry: 3200, exit: 3120, stop: 3150, target: 3450,
    sizeUsd: 3000, leverage: 3, regime: "RANGE", setup: "BREAKOUT", signalScore: 71,
    entryReason: "突破区间上沿", exitReason: "假突破回落止损", result: -600, rMultiple: -1.0,
    mistake: "EARLY_ENTRY", tags: ["假突破"], notes: "区间未确认就追", openedAt: Date.now() - 86400e3 * 7, closedAt: Date.now() - 86400e3 * 6,
  },
  {
    id: "t-3", symbol: "SOLUSDT", side: "LONG", entry: 165, exit: 178, stop: 158, target: 180,
    sizeUsd: 2500, leverage: 4, regime: "BULL_TREND", setup: "RE_ENTRY", signalScore: 79,
    entryReason: "二次入场确认放量", exitReason: "接近目标主动止盈", result: 900, rMultiple: 2.2,
    mistake: "NONE", tags: ["动量"], notes: "", openedAt: Date.now() - 86400e3 * 12, closedAt: Date.now() - 86400e3 * 10,
  },
];

export function JournalPanel() {
  const storeTrades = useTradingStore((s) => s.trades);
  const addTrade = useTradingStore((s) => s.addTrade);
  const updateTrade = useTradingStore((s) => s.updateTrade);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [showForm, setShowForm] = useState(false);

  const trades = (storeTrades.length > 0 ? storeTrades : DEFAULT_TRADES);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">交易日志</h2>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-info/80"
        >
          <Plus className="h-3.5 w-3.5" /> 新增交易
        </button>
      </div>

      {showForm && (
        <TradeForm
          initial={editing ?? undefined}
          onCancel={() => setShowForm(false)}
          onSubmit={(t) => {
            if (editing) updateTrade(t);
            else addTrade(t);
            setShowForm(false);
          }}
        />
      )}

      <div className="space-y-3">
        {trades.map((t) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text">{t.symbol.replace("USDT", "")}</span>
                <Badge tone={t.side === "LONG" ? "bull" : "bear"}>{SIDE_LABEL[t.side]}</Badge>
                <Badge tone={regimeTone(t.regime)}>{REGIME_LABEL_ZH[t.regime]}</Badge>
                <Badge tone="neutral">{SETUP_LABEL[t.setup]}</Badge>
                {t.mistake !== "NONE" && <Badge tone="bear">{MISTAKES.find(m => m.v === t.mistake)?.label}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("num text-base font-bold", t.result >= 0 ? "text-bull" : "text-bear")}>
                  {formatUsd(t.result)}
                </span>
                <span className={cn("num text-sm", t.rMultiple >= 0 ? "text-bull" : "text-bear")}>
                  ({t.rMultiple >= 0 ? "+" : ""}{t.rMultiple}R)
                </span>
                <button
                  onClick={() => { setEditing(t); setShowForm(true); }}
                  className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-text"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
              <span>入场 <span className="num text-text">{formatPrice(t.entry)}</span></span>
              <span>出场 <span className="num text-text">{formatPrice(t.exit)}</span></span>
              <span>止损 <span className="num text-bear">{formatPrice(t.stop)}</span></span>
              <span>目标 <span className="num text-bull">{formatPrice(t.target)}</span></span>
              <span>仓位 <span className="num text-text">{formatUsd(t.sizeUsd)}</span></span>
              <span>杠杆 <span className="num text-text">{t.leverage}X</span></span>
              <span>信号 <span className="num text-text">{t.signalScore}</span></span>
            </div>

            <div className="mt-2 border-t border-border pt-2 text-xs leading-relaxed text-muted">
              <div><span className="text-text/70">入场：</span>{t.entryReason || "—"}</div>
              <div><span className="text-text/70">出场：</span>{t.exitReason || "—"}</div>
              {t.notes && <div><span className="text-text/70">备注：</span>{t.notes}</div>}
            </div>
            {t.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.tags.map((tag) => (
                  <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-muted">#{tag}</span>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function TradeForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Trade;
  onSubmit: (t: Trade) => void;
  onCancel: () => void;
}) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? "BTCUSDT");
  const [side, setSide] = useState<Side>(initial?.side ?? "LONG");
  const [entry, setEntry] = useState(String(initial?.entry ?? 100000));
  const [exit, setExit] = useState(String(initial?.exit ?? 0));
  const [stop, setStop] = useState(String(initial?.stop ?? 98000));
  const [target, setTarget] = useState(String(initial?.target ?? 104000));
  const [sizeUsd, setSizeUsd] = useState(String(initial?.sizeUsd ?? 5000));
  const [leverage, setLeverage] = useState(String(initial?.leverage ?? 5));
  const [regime, setRegime] = useState<RegimeState>(initial?.regime ?? "BULL_TREND");
  const [setup, setSetup] = useState<SetupType>(initial?.setup ?? "PULLBACK");
  const [mistake, setMistake] = useState<MistakeType>(initial?.mistake ?? "NONE");
  const [entryReason, setEntryReason] = useState(initial?.entryReason ?? "");
  const [exitReason, setExitReason] = useState(initial?.exitReason ?? "");
  const [tags, setTags] = useState(initial?.tags.join(",") ?? "");

  const submit = () => {
    const e = parseFloat(entry) || 0;
    const x = parseFloat(exit) || e;
    const r = initial?.id ?? `t-${Date.now()}`;
    onSubmit({
      id: r,
      symbol, side,
      entry: e, exit: x,
      stop: parseFloat(stop) || 0,
      target: parseFloat(target) || 0,
      sizeUsd: parseFloat(sizeUsd) || 0,
      leverage: parseInt(leverage) || 1,
      regime, setup,
      signalScore: initial?.signalScore ?? 0,
      entryReason, exitReason,
      result: (x - e) * (side === "LONG" ? 1 : -1),
      rMultiple: x !== e ? ((x - e) * (side === "LONG" ? 1 : -1)) / Math.abs(e - (parseFloat(stop) || 0)) : 0,
      mistake, tags: tags.split(",").map(s => s.trim()).filter(Boolean),
      notes: initial?.notes ?? "",
      openedAt: initial?.openedAt ?? Date.now(),
      closedAt: Date.now(),
    });
  };

  return (
    <Card className="border-info/30">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{initial ? "编辑交易" : "新增交易"}</h3>
        <button onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-text"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="币种"><input value={symbol} onChange={e => setSymbol(e.target.value)} className={inpCls} /></Field>
        <Field label="方向">
          <select value={side} onChange={e => setSide(e.target.value as Side)} className={inpCls}>
            <option value="LONG">做多</option><option value="SHORT">做空</option>
          </select>
        </Field>
        <Field label="入场价"><input value={entry} onChange={e => setEntry(e.target.value)} className={inpCls} /></Field>
        <Field label="出场价"><input value={exit} onChange={e => setExit(e.target.value)} className={inpCls} /></Field>
        <Field label="止损"><input value={stop} onChange={e => setStop(e.target.value)} className={inpCls} /></Field>
        <Field label="目标"><input value={target} onChange={e => setTarget(e.target.value)} className={inpCls} /></Field>
        <Field label="仓位 (USD)"><input value={sizeUsd} onChange={e => setSizeUsd(e.target.value)} className={inpCls} /></Field>
        <Field label="杠杆"><input value={leverage} onChange={e => setLeverage(e.target.value)} className={inpCls} /></Field>
        <Field label="市场状态">
          <select value={regime} onChange={e => setRegime(e.target.value as RegimeState)} className={inpCls}>
            <option value="BULL_TREND">多头趋势</option><option value="BEAR_TREND">空头趋势</option><option value="RANGE">震荡区间</option><option value="TRANSITION">趋势转换</option><option value="CRASH_RISK">崩盘风险</option>
          </select>
        </Field>
        <Field label="形态">
          <select value={setup} onChange={e => setSetup(e.target.value as SetupType)} className={inpCls}>
            <option value="PULLBACK">回踩</option><option value="BREAKOUT">突破</option><option value="RE_ENTRY">二次入场</option><option value="RESTART">重启</option><option value="RANGE">区间</option><option value="NONE">无</option>
          </select>
        </Field>
        <Field label="错误类型">
          <select value={mistake} onChange={e => setMistake(e.target.value as MistakeType)} className={inpCls}>
            {MISTAKES.map(m => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="标签（逗号分隔）"><input value={tags} onChange={e => setTags(e.target.value)} className={inpCls} /></Field>
        <Field label="入场理由" full><input value={entryReason} onChange={e => setEntryReason(e.target.value)} className={inpCls} /></Field>
        <Field label="出场理由" full><input value={exitReason} onChange={e => setExitReason(e.target.value)} className={inpCls} /></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-text">取消</button>
        <button onClick={submit} className="rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-white hover:bg-info/80">保存</button>
      </div>
    </Card>
  );
}

const inpCls = "h-9 w-full rounded-md border border-border bg-surface px-2.5 text-xs text-text placeholder:text-muted focus:border-info focus:outline-none";

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-4" : ""}>
      <label className="mb-1 block text-[11px] text-muted">{label}</label>
      {children}
    </div>
  );
}