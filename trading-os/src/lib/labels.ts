import type {
  RegimeState,
  Trend,
  Action,
  RiskLevel,
  RiskStatus,
  SystemStatus,
  Side,
  SetupType,
  SetupStage,
  Impact,
  AlertType,
  AlertStatus,
} from "@/types";

// 统一的颜色映射，保证全站一致
export const REGIME_LABEL: Record<RegimeState, string> = {
  BULL_TREND: "多头趋势",
  BEAR_TREND: "空头趋势",
  RANGE: "震荡区间",
  TRANSITION: "趋势转换",
  CRASH_RISK: "崩盘风险",
};

export const REGIME_LABEL_ZH: Record<RegimeState, string> = REGIME_LABEL;

export const TREND_LABEL: Record<Trend, string> = {
  BULL: "多头",
  BEAR: "空头",
  RANGE: "震荡",
  TRANSITION: "转换",
  CRASH_RISK: "崩盘风险",
};

export const ACTION_LABEL: Record<Action, string> = {
  LONG: "做多",
  SHORT: "做空",
  WATCH: "关注",
  WAIT: "等待",
  AVOID: "回避",
  REDUCE: "减仓",
  EXIT: "离场",
};

export const SIDE_LABEL: Record<Side, string> = {
  LONG: "做多",
  SHORT: "做空",
  FLAT: "空仓",
};

export const SETUP_LABEL: Record<SetupType, string> = {
  PULLBACK: "回踩",
  BREAKOUT: "突破",
  RE_ENTRY: "二次入场",
  RESTART: "重启",
  RANGE: "区间",
  NONE: "无",
};

export const SETUP_STAGE_LABEL: Record<SetupStage, string> = {
  WAIT: "等待",
  BREAKOUT: "突破",
  PULLBACK: "回踩",
  RESTART: "重启",
  ENTRY: "入场",
  MANAGE: "持仓管理",
  EXIT: "离场",
  INVALIDATED: "失效",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  BULLISH: "利好",
  BEARISH: "利空",
  NEUTRAL: "中性",
};

export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  PRICE: "价格",
  SIGNAL: "信号",
  RISK: "风险",
  SYSTEM: "系统",
};

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  ACTIVE: "活跃",
  TRIGGERED: "已触发",
  DISMISSED: "已忽略",
};

export const RISK_LABEL: Record<RiskLevel, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
};

export const RISK_STATUS_LABEL: Record<RiskStatus, string> = {
  SAFE: "安全",
  CAUTION: "谨慎",
  WARNING: "警告",
  DANGER: "危险",
};

export const SYSTEM_STATUS_LABEL: Record<SystemStatus, string> = {
  NORMAL: "正常",
  WARNING: "警告",
  SYSTEM_DEGRADATION: "系统降级",
  SYSTEM_FAILURE: "系统故障",
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