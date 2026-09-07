// =============================================================
// 格式化工具
// =============================================================

/** 千分位数字 */
export function fmtNumber(n: number, decimals = 2): string {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** 简写金额：1.23B / 456M / 789K */
export function fmtCompact(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

/** 百分比：带正负号 */
export function fmtPct(n: number, decimals = 1): string {
  if (!isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

/** 价格格式化（根据量级调整精度） */
export function fmtPrice(n: number): string {
  if (!isFinite(n)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(2)}`;
}

/** 时间戳格式化 */
export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 根据数值返回涨跌语义色 class */
export function colorBy(n: number): string {
  if (n > 1e-9) return "text-emerald-400";
  if (n < -1e-9) return "text-rose-400";
  return "text-slate-400";
}

/** 保留两位小数的 0-100 分数 */
export function fmtScore(n: number): string {
  if (!isFinite(n)) return "—";
  return n.toFixed(0);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** 平滑归一到 0-1（用于子分数计算） */
export function norm01(n: number): number {
  return clamp(n, 0, 1);
}