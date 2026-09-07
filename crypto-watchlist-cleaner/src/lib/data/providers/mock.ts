// =============================================================
// Mock Provider —— 默认数据源，无需任何 API Key
// =============================================================
import type { TokenRaw } from "../../types";
import { generateMockTokens } from "../mockData";
import type { TokenProvider } from "./types";

export class MockProvider implements TokenProvider {
  readonly name = "mock";
  private cache: TokenRaw[] | null = null;

  async fetchTokens(): Promise<TokenRaw[]> {
    // 轻微延迟模拟网络，实际同步返回缓存
    if (!this.cache) {
      this.cache = generateMockTokens();
    }
    return this.cache;
  }
}