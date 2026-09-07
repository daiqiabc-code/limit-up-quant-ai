// =============================================================
// 确定性伪随机数生成器（mulberry32）
// 用于 Mock 数据：相同 seed 生成相同结果，保证可复现、可测试。
// =============================================================

export type Rng = () => number;

/** mulberry32 PRNG */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由字符串生成 seed */
export function seedFromString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 在 [min, max) 均匀取一个随机数 */
export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** 近似正态分布（Box-Muller，取一个正交分量） */
export function randGaussian(rng: Rng, mean = 0, std = 1): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** 从数组随机取一个 */
export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** 生成 [min,max] 的对数均匀随机数（用于市值/成交额） */
export function randLogRange(rng: Rng, min: number, max: number): number {
  const lmin = Math.log(min);
  const lmax = Math.log(max);
  return Math.exp(lmin + rng() * (lmax - lmin));
}

/** 以给定概率返回 true */
export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}