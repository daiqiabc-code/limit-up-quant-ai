/**
 * 5 维分项进度条组件
 * 展示连板强度/封单质量/板块地位/题材新鲜度/量价健康 的得分
 */

import type { SubScores } from '../lib/api';

const DIM_LABELS: { key: keyof SubScores; label: string; color: string }[] = [
  { key: 'board_strength', label: '连板强度', color: 'bg-red-400' },
  { key: 'seal_quality', label: '封单质量', color: 'bg-amber-400' },
  { key: 'sector_position', label: '板块地位', color: 'bg-sky-400' },
  { key: 'theme_freshness', label: '题材新鲜度', color: 'bg-fuchsia-400' },
  { key: 'volume_health', label: '量价健康', color: 'bg-emerald-400' },
];

/** 单条进度条 */
function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-terminal-dim w-16 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-2 bg-terminal-card rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-mono text-terminal-text w-8 shrink-0">{value.toFixed(0)}</span>
    </div>
  );
}

/** 5 维分项进度条组 */
export function ScoreBar({ scores, compact = false }: { scores: SubScores; compact?: boolean }) {
  return (
    <div className={`space-y-${compact ? '1' : '2'}`}>
      {DIM_LABELS.map(({ key, label, color }) => (
        <Bar key={key} label={label} value={scores[key]} color={color} />
      ))}
    </div>
  );
}

export default ScoreBar;
