// =============================================================
// 数据源公共 HTTP 工具
// - apiGetJson：统一网络错误 / 限频(429) / 鉴权错误映射
// - mapLimit：带并发上限的批量请求池（用于批量 kline 拉取）
// =============================================================
import { ProviderError } from "./types";

/** 发起 GET 并解析 JSON，把异常映射为 ProviderError 的四种类型 */
export async function apiGetJson<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, headers ? { headers } : undefined);
  } catch (e) {
    throw new ProviderError(`网络错误: ${(e as Error).message}`, "network");
  }
  if (res.status === 429) {
    throw new ProviderError(`限频(429): ${url.split("?")[0]}`, "rate_limited");
  }
  if (res.status === 401 || res.status === 403) {
    throw new ProviderError(`鉴权失败(HTTP ${res.status})`, "not_configured");
  }
  if (!res.ok) {
    throw new ProviderError(`HTTP ${res.status}: ${url.split("?")[0]}`, "network");
  }
  return (await res.json()) as T;
}

/**
 * 并发受限的 map。
 * 分批并发执行 fn，避免一次性发起过多请求触发限频。
 */
export async function mapLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit = 8,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}