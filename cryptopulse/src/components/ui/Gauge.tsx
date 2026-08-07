import { cn } from "@/lib/utils";

/** Semicircle sentiment gauge, 0-100 */
export function SentimentGauge({
  value,
  size = 120,
  label,
  className,
}: {
  value: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 180;
  const endAngle = 0;
  const angle = startAngle - (v / 100) * (startAngle - endAngle);
  const polar = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const [nx, ny] = polar(angle);

  const color =
    v >= 70 ? "#2EE6A6" : v >= 45 ? "#FFB020" : v >= 30 ? "#FF8A4C" : "#FF5C7A";
  const mood = v >= 70 ? "贪婪" : v >= 45 ? "中性" : v >= 30 ? "谨慎" : "恐惧";

  const arcPath = (from: number, to: number) => {
    const [x1, y1] = polar(from);
    const [x2, y2] = polar(to);
    const large = Math.abs(from - to) > 180 ? 1 : 0;
    const sweep = from > to ? 1 : 0;
    return `M${x1},${y1} A${r},${r} 0 ${large} ${sweep} ${x2},${y2}`;
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width={size} height={size / 2 + 14} viewBox={`0 0 ${size} ${size / 2 + 14}`}>
        <path d={arcPath(180, 0)} fill="none" stroke="#161F2E" strokeWidth={8} strokeLinecap="round" />
        <path
          d={arcPath(180, angle)}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: "all 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <circle cx={nx} cy={ny} r={4} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-ink-high font-mono" style={{ fontSize: size * 0.2, fontWeight: 600 }}>
          {Math.round(v)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-ink-low" style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
          {label ?? mood}
        </text>
      </svg>
    </div>
  );
}

/** Radial score ring */
export function ScoreRing({
  value,
  size = 56,
  stroke = 5,
  color = "#16E6C8",
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#161F2E" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)", filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-semibold text-ink-high tnum">{Math.round(v)}</span>
        {label && <span className="text-[9px] text-ink-low uppercase tracking-wide">{label}</span>}
      </div>
    </div>
  );
}
