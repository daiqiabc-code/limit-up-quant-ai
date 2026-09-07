// =============================================================
// 通用 UI 原语（深色量化终端风格）
// =============================================================
import type { ReactNode } from "react";
import { clamp } from "../lib/utils/format";

/** 面板容器 */
export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-terminal-border bg-terminal-panel ${className}`}
    >
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-terminal-border px-4 py-2.5">
          <h3 className="text-[13px] font-semibold text-terminal-bright">
            {title}
          </h3>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

/** 语义徽章 */
export function Badge({
  tone = "slate",
  children,
  className = "",
}: {
  tone?:
    | "slate"
    | "green"
    | "red"
    | "amber"
    | "violet"
    | "blue"
    | "cyan";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    red: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium leading-none ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** 叙事标签 */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-violet-500/10 px-1.5 py-0.5 text-[11px] leading-none text-violet-400">
      {children}
    </span>
  );
}

/** KPI 卡片 */
export function StatCard({
  label,
  value,
  sub,
  accent = "text-terminal-bright",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-terminal-muted">
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-terminal-muted">{sub}</div>}
    </div>
  );
}

/** 评分条 */
export function ScoreBar({
  value,
  max = 100,
  tone,
}: {
  value: number;
  max?: number;
  tone?: "auto" | string;
}) {
  const pct = clamp((value / max) * 100, 0, 100);
  const color =
    tone && tone !== "auto"
      ? tone
      : value >= 80
        ? "bg-emerald-400"
        : value >= 55
          ? "bg-amber-400"
          : "bg-rose-400";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-terminal-border">
      <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** 风险仪表盘（半圆） */
export function RiskGauge({ score }: { score: number }) {
  const s = clamp(score, 0, 100);
  const angle = -90 + (s / 100) * 180;
  const color = s >= 70 ? "#f43f5e" : s >= 40 ? "#f59e0b" : "#10b981";
  return (
    <div className="relative flex flex-col items-center">
      <svg viewBox="0 0 120 70" className="w-full max-w-[160px]">
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke="#1b2536"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(s / 100) * 157} 157`}
          transform={`rotate(${angle} 60 65)`}
          style={{ transformOrigin: "60px 65px" }}
        />
      </svg>
      <div className="-mt-6 text-2xl font-bold tabular-nums text-terminal-bright">
        {Math.round(s)}
      </div>
      <div className="text-[11px] text-terminal-muted">Risk Score</div>
    </div>
  );
}