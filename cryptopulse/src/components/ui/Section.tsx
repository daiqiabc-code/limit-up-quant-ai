import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SectionHeader({
  index,
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  index?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex items-center gap-3">
        {index && (
          <span className="font-mono text-xs text-signal/70 tabular-nums">{index}</span>
        )}
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-bg-elevated text-signal">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink-high sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-ink-low">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Panel({
  children,
  className,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "panel",
        hover && "transition-all duration-300 hover:border-line-strong hover:bg-bg-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}
