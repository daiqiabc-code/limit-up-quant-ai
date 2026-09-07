// =============================================================
// DexScreener / Birdeye / GMGN Provider（骨架实现）
// 用于上链 DEX 数据、Holder、Smart Money、Meme 指标，后续接入。
// =============================================================
import { ProviderError, type TokenProvider } from "./types";
import type { TokenRaw } from "../../types";

export class DexScreenerProvider implements TokenProvider {
  readonly name = "dexscreener";
  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError("DexScreener 数据源尚未接入", "not_configured");
  }
}

export class BirdeyeProvider implements TokenProvider {
  readonly name = "birdeye";
  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError("Birdeye 数据源尚未接入", "not_configured");
  }
}

export class GmgnProvider implements TokenProvider {
  readonly name = "gmgn";
  async fetchTokens(): Promise<TokenRaw[]> {
    throw new ProviderError("GMGN 数据源尚未接入", "not_configured");
  }
}