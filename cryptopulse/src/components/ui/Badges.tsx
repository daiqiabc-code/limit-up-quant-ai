import { cn } from "@/lib/utils";
import type { Direction, Importance } from "@/lib/types";

export function DirectionBadge({
  direction,
  className,
  size = "sm",
}: {
  direction: Direction;
  className?: string;
  size?: "sm" | "xs";
}) {
  const map: Record<Direction, { label: string; cls: string }> = {
    bullish: { label: "看多", cls: "chip-bull" },
    bearish: { label: "看空", cls: "chip-bear" },
    neutral: { label: "中性", cls: "chip-warn" },
  };
  const v = map[direction];
  return (
    <span className={cn(v.cls, size === "xs" && "text-[10px] px-1 py-0", className)}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {v.label}
    </span>
  );
}

export function ImportanceBadge({
  importance,
  className,
}: {
  importance: Importance;
  className?: string;
}) {
  const map: Record<Importance, { label: string; cls: string }> = {
    critical: { label: "Critical", cls: "chip-bear border-bear/40 text-bear" },
    high: { label: "High", cls: "chip-warn" },
    medium: { label: "Medium", cls: "chip-info" },
    low: { label: "Low", cls: "chip" },
  };
  const v = map[importance];
  return <span className={cn(v.cls, className)}>{v.label}</span>;
}

export function ScoreBar({
  value,
  max = 100,
  color = "#16E6C8",
  className,
  height = 4,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-bg-elevated", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}66` }}
      />
    </div>
  );
}

export function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "tnum font-medium tabular-nums",
        up ? "text-bull" : "text-bear",
        className
      )}
    >
      {up ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}
