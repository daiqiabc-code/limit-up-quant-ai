import type { RegimeState, Trend, Action, RiskLevel, RiskStatus, SystemStatus } from "@/types";

// 统一的颜色映射，保证全站一致
export const REGIME_LABEL: Record<RegimeState, string> = {
  BULL_TREND: "BULL TREND",
  BEAR_TREND: "BEAR TREND",
  RANGE: "RANGE",
  TRANSITION: "TRANSITION",
  CRASH_RISK: "CRASH RISK",
};

export const REGIME_LABEL_ZH: Record<RegimeState, string> = {
  BULL_TREND: "多头趋势",
  BEAR_TREND: "空头趋势",
  RANGE: "震荡区间",
  TRANSITION: "趋势转换",
  CRASH_RISK: "崩盘风险",
};

export const TREND_LABEL: Record<Trend, string> = {
  BULL: "BULL",
  BEAR: "BEAR",
  RANGE: "RANGE",
  TRANSITION: "TRANSITION",
  CRASH_RISK: "CRASH RISK",
};

export const ACTION_LABEL: Record<Action, string> = {
  LONG: "LONG",
  SHORT: "SHORT",
  WATCH: "WATCH",
  WAIT: "WAIT",
  AVOID: "AVOID",
  REDUCE: "REDUCE",
  EXIT: "EXIT",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  SAFE: "SAFE",
  CAUTION: "CAUTION",
  WARNING: "WARNING",
  DANGER: "DANGER",
};

export const SYSTEM_STATUS_LABEL: Record<SystemStatus, string> = {
  NORMAL: "NORMAL",
  WARNING: "WARNING",
  SYSTEM_DEGRADATION: "SYSTEM DEGRADATION",
  SYSTEM_FAILURE: "SYSTEM FAILURE",
};

export function regimeTone(state: RegimeState): "bull" | "bear" | "warn" | "purple" {
  switch (state) {
    case "BULL_TREND":
      return "bull";
    case "BEAR_TREND":
      return "bear";
    case "RANGE":
      return "warn";
    case "TRANSITION":
      return "purple";
    case "CRASH_RISK":
      return "bear";
  }
}

export function regimeColor(state: RegimeState): string {
  switch (state) {
    case "BULL_TREND":
      return "#22C55E";
    case "BEAR_TREND":
      return "#EF4444";
    case "RANGE":
      return "#F59E0B";
    case "TRANSITION":
      return "#A855F7";
    case "CRASH_RISK":
      return "#B91C1C";
  }
}

export function actionTone(action: Action): "bull" | "bear" | "warn" | "info" | "neutral" {
  switch (action) {
    case "LONG":
      return "bull";
    case "SHORT":
    case "EXIT":
      return "bear";
    case "WATCH":
      return "info";
    case "WAIT":
      return "warn";
    case "AVOID":
      return "neutral";
    case "REDUCE":
      return "warn";
  }
}

export function riskTone(risk: RiskLevel): "bull" | "warn" | "bear" {
  switch (risk) {
    case "LOW":
      return "bull";
    case "MEDIUM":
      return "warn";
    case "HIGH":
      return "bear";
  }
}

export function riskStatusTone(status: RiskStatus): "bull" | "warn" | "bear" {
  switch (status) {
    case "SAFE":
      return "bull";
    case "CAUTION":
      return "warn";
    case "WARNING":
      return "warn";
    case "DANGER":
      return "bear";
  }
}

export function systemStatusTone(status: SystemStatus): "bull" | "warn" | "bear" | "purple" {
  switch (status) {
    case "NORMAL":
      return "bull";
    case "WARNING":
      return "warn";
    case "SYSTEM_DEGRADATION":
      return "purple";
    case "SYSTEM_FAILURE":
      return "bear";
  }
}