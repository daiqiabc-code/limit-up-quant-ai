import { Thermometer } from "lucide-react";
import { SentimentDashboard } from "@/components/home/SentimentDashboard";

export default function SentimentPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
          <Thermometer className="h-4 w-4" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-ink-high sm:text-2xl">市场情绪中心</h1>
          <p className="text-sm text-ink-low">0–100 情绪指数 · 全市场与主流板块 · 24h / 7d / 30d 趋势</p>
        </div>
      </div>
      <SentimentDashboard />
    </div>
  );
}
