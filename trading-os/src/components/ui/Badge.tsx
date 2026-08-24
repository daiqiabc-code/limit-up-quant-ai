import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "bull" | "bear" | "warn" | "info" | "neutral" | "purple";

const TONES: Record<Tone, string> = {
  bull: "bg-bull/10 text-bull border-bull/30",
  bear: "bg-bear/10 text-bear border-bear/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  info: "bg-info/10 text-info border-info/30",
  neutral: "bg-muted/10 text-muted border-muted/30",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}