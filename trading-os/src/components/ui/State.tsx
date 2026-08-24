"use client";

import { Loader2, TriangleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted">
      <TriangleAlert className="h-5 w-5 text-warn" />
      <span className="text-xs">{message ?? "数据加载失败"}</span>
    </div>
  );
}

export function EmptyState({ label = "暂无数据" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted">
      <Inbox className="h-5 w-5" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

export function StatValue({
  label,
  value,
  sub,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "bull" | "bear" | "warn" | "neutral";
  className?: string;
}) {
  const toneCls =
    tone === "bull"
      ? "text-bull"
      : tone === "bear"
        ? "text-bear"
        : tone === "warn"
          ? "text-warn"
          : "text-text";
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <span className={cn("mt-1 text-lg font-semibold tabular", toneCls)}>{value}</span>
      {sub && <span className="mt-0.5 text-[11px] text-muted">{sub}</span>}
    </div>
  );
}