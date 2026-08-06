/**
 * 双评级徽章组件
 * abs_grade：实心徽章（绝对评级，模型自身概率）
 * rel_grade：描边徽章（相对评级，池内百分位）
 */

const gradeStyles: Record<string, { solid: string; outline: string }> = {
  S: { solid: 'bg-fuchsia-500 text-white', outline: 'border-fuchsia-500 text-fuchsia-400' },
  A: { solid: 'bg-red-500 text-white', outline: 'border-red-500 text-red-400' },
  B: { solid: 'bg-amber-500 text-white', outline: 'border-amber-500 text-amber-400' },
  C: { solid: 'bg-sky-500 text-white', outline: 'border-sky-500 text-sky-400' },
  D: { solid: 'bg-gray-500 text-white', outline: 'border-gray-500 text-gray-400' },
};

/** 单个评级徽章 */
export function GradeBadge({
  grade,
  type = 'abs',
  size = 'md',
}: {
  grade: string;
  type?: 'abs' | 'rel';
  size?: 'sm' | 'md';
}) {
  const s = gradeStyles[grade] ?? gradeStyles.D;
  const isAbs = type === 'abs';
  const sizeCls = size === 'sm' ? 'w-6 h-6 text-xs' : 'w-8 h-8 text-sm';

  return (
    <span
      title={isAbs ? `绝对评级 ${grade}` : `相对评级 ${grade}`}
      className={`inline-flex items-center justify-center rounded font-bold ${sizeCls} ${
        isAbs ? s.solid : `bg-transparent border ${s.outline}`
      }`}
    >
      {grade}
    </span>
  );
}

/** 双评级组合徽章 */
export function DualGradeBadge({
  absGrade,
  relGrade,
  percentile,
}: {
  absGrade: string;
  relGrade: string;
  percentile?: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <GradeBadge grade={absGrade} type="abs" />
      <GradeBadge grade={relGrade} type="rel" />
      {percentile !== undefined && (
        <span className="text-xs text-terminal-dim ml-0.5">P{percentile}</span>
      )}
    </div>
  );
}

export default GradeBadge;
