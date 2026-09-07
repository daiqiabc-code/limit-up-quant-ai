// =============================================================
// 评分通用工具：线性映射 + 截断
// 所有因子评分都使用相同 scale，保证口径一致。
// =============================================================

/** 将 v ∈ [lo, hi] 线性映射到 [outLo, outHi]，越界自动截断 */
export function scale(
  v: number,
  lo: number,
  hi: number,
  outLo: number,
  outHi: number,
): number {
  if (hi === lo) return outLo;
  const t = clamp((v - lo) / (hi - lo), 0, 1);
  return outLo + t * (outHi - outLo);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** 圆整到指定小数位 */
export function round(n: number, d = 2): number {
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}