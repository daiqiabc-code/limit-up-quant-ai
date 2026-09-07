// =============================================================
// 分级 / 趋势 / 资金流徽章
// =============================================================
import type { Grade, TrendLabel, MoneyFlowLabel } from "../lib/types";
import { Badge } from "./ui";

export function GradeBadge({ grade, strong }: { grade: Grade; strong?: boolean }) {
  const map: Record<Grade, { tone: "violet" | "blue" | "cyan" | "slate"; label: string }> = {
    S: { tone: "violet", label: "S" },
    A: { tone: "blue", label: "A" },
    B: { tone: "cyan", label: "B" },
    C: { tone: "slate", label: strong ? "C*" : "C" },
  };
  const m = map[grade];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

const TREND_TONE: Record<TrendLabel, "green" | "red" | "slate"> = {
  StrongUp: "green",
  Up: "green",
  Neutral: "slate",
  Down: "red",
  StrongDown: "red",
};
const TREND_TXT: Record<TrendLabel, string> = {
  StrongUp: "强上升",
  Up: "上升",
  Neutral: "中性",
  Down: "下降",
  StrongDown: "强下降",
};

export function TrendBadge({ trend }: { trend: TrendLabel }) {
  return <Badge tone={TREND_TONE[trend]}>{TREND_TXT[trend]}</Badge>;
}

const FLOW_TONE: Record<MoneyFlowLabel, "green" | "red" | "slate"> = {
  StrongInflow: "green",
  Inflow: "green",
  Neutral: "slate",
  Outflow: "red",
  StrongOutflow: "red",
};
const FLOW_TXT: Record<MoneyFlowLabel, string> = {
  StrongInflow: "强流入",
  Inflow: "流入",
  Neutral: "中性",
  Outflow: "流出",
  StrongOutflow: "强流出",
};

export function MoneyFlowBadge({ flow }: { flow: MoneyFlowLabel }) {
  return <Badge tone={FLOW_TONE[flow]}>{FLOW_TXT[flow]}</Badge>;
}