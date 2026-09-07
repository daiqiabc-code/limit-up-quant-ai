/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: string;
  readonly VITE_COINGECKO_API_KEY?: string;
  readonly VITE_CMC_API_KEY?: string;
  readonly VITE_BINANCE_API_URL?: string;
  readonly VITE_DEXSCREENER_API_URL?: string;
  readonly VITE_AI_API_URL?: string;
  readonly VITE_AI_API_KEY?: string;
  readonly VITE_REFRESH_INTERVAL_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}