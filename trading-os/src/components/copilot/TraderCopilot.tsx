"use client";

import { useMemo, useState } from "react";
import { useTradingStore, buildOpportunities, getTodayAction } from "@/store/tradingStore";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { REGIME_LABEL, REGIME_LABEL_ZH, RISK_STATUS_LABEL, ACTION_LABEL, SETUP_LABEL, SIDE_LABEL } from "@/lib/labels";
import { formatUsd } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "BTC现在属于什么市场状态？",
  "今天最值得关注的3个币是什么？",
  "为什么BTC评分这么高？",
  "当前组合风险是多少？",
  "现在应该交易还是等待？",
];

export function TraderCopilot() {
  const open = useTradingStore((s) => s.copilotOpen);
  const setOpen = useTradingStore((s) => s.setCopilotOpen);
  const snapshot = useTradingStore((s) => s.snapshot);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "你好，我是交易助手。我基于本 Dashboard 的实时行情回答你的问题。" },
  ]);

  const dsLabel =
    snapshot?.dataSource === "LIVE_BINANCE"
      ? "Binance 实时"
      : snapshot?.dataSource === "LIVE_OKX"
        ? "OKX 实时"
        : snapshot?.dataSource === "FALLBACK"
          ? "实时降级"
          : "模拟数据";

  const answer = useMemo(() => {
    if (!snapshot) return () => "";
    const opps = buildOpportunities(snapshot);
    const btc = snapshot.signals["BTCUSDT"];
    const action = getTodayAction(snapshot);

    return (q: string): string => {
      const s = q.toLowerCase();
      if (s.includes("市场状态") || s.includes("什么状态") || s.includes("regime")) {
        return `当前市场状态为 ${REGIME_LABEL[snapshot.regime.state]}。` +
          `日线 ${dirZh(snapshot.regime.daily)}、4H ${dirZh(snapshot.regime.h4)}、1H ${dirZh(snapshot.regime.h1)}。` +
          `ADX ${snapshot.regime.adx}，成交量 ${snapshot.regime.volume}，结构 ${snapshot.regime.structure}。`;
      }
      if (s.includes("3个") || s.includes("三个") || s.includes("值得关注") || s.includes("什么币")) {
        const top = opps.slice(0, 3);
        return "今天最值得关注的 3 个币：\n" +
          top.map((o, i) => `${i + 1}. ${o.symbol.replace("USDT", "")} — 评分 ${o.score}，${SETUP_LABEL[o.setup]}，建议 ${ACTION_LABEL[o.action]}`).join("\n");
      }
      if (s.includes("为什么") || s.includes("评分") || s.includes("score")) {
        if (!btc) return "暂无数据。";
        return `BTC 评分 ${btc.score}/100 构成：趋势 ${btc.breakdown.trend}/20 · 结构 ${btc.breakdown.structure}/20 · 动量 ${btc.breakdown.momentum}/20 · 成交量 ${btc.breakdown.volume}/15 · 大周期共振 ${btc.breakdown.htfAlignment}/10 · 形态 ${btc.breakdown.setup}/10 · 风险回报 ${btc.breakdown.riskReward}/5。核心原因：${btc.reason}。`;
      }
      if (s.includes("风险") || s.includes("heat") || s.includes("组合")) {
        return `当前组合风险：组合热度 ${snapshot.risk.portfolioHeat}%（${RISK_STATUS_LABEL[snapshot.risk.status]}）。` +
          `账户权益 ${formatUsd(snapshot.risk.accountEquity, 0)}，每日风险 ${snapshot.risk.dailyRisk}%，回撤 ${snapshot.risk.currentDrawdown}%。`;
      }
      if (s.includes("交易") || s.includes("等待") || s.includes("做") || s.includes("等")) {
        const label = action === "TRADE" ? "🟢 可执行" : action === "WAIT" ? "🟡 等待（等待更强信号）" : "🔴 停手";
        return `当前建议：${label}。有效机会 ${opps.filter(o => o.action === "LONG" || o.action === "WATCH").length} 个，组合热度 ${snapshot.risk.portfolioHeat}%。`;
      }
      return `我可以回答：市场状态、机会扫描、评分构成、组合风险、交易决策等。请尝试下方快捷问题。`;
    };
  }, [snapshot]);

  const dirZh = (d: string) => (d === "UP" ? "↑ 上涨" : d === "DOWN" ? "↓ 下跌" : "→ 震荡");

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    const a = answer(q);
    setTimeout(() => setMsgs((m) => [...m, { role: "assistant", text: a }]), 300);
  };

  return (
    <>
      {open && (
        <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-panel lg:flex">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-info/15 text-info">
                <Bot className="h-4 w-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold text-text">交易助手</div>
                <div className={cn("text-[10px]", snapshot?.dataSource === "MOCK" || snapshot?.dataSource === "FALLBACK" ? "text-warn" : "text-bull")}>
                  {dsLabel}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-white/5 hover:text-text">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-xs leading-relaxed",
                    m.role === "user" ? "bg-info/15 text-text" : "bg-surface text-text",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-muted transition-colors hover:border-info/40 hover:text-info"
                >
                  <Sparkles className="h-3 w-3" />
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="询问你的交易系统…"
                className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-xs text-text placeholder:text-muted focus:border-info focus:outline-none"
              />
              <button
                onClick={() => send()}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-info text-white transition-colors hover:bg-info/80"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}