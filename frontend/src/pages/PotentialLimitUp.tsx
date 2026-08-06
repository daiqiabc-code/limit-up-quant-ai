import { useEffect, useState } from 'react';
import { Zap, Target, AlertTriangle } from 'lucide-react';
import { api, ScannerSnapshot, ScoredRecord } from '../lib/api';
import { DualGradeBadge } from '../components/GradeBadge';
import { ScoreBar } from '../components/ScoreBar';

/** 总分颜色：按绝对评级（S=fuchsia / A=red / B=amber / C=sky / D=gray） */
const scoreColor = (grade: string) =>
  grade === 'S' ? 'text-fuchsia-400'
    : grade === 'A' ? 'text-red-400'
    : grade === 'B' ? 'text-amber-400'
    : grade === 'C' ? 'text-sky-400'
    : 'text-gray-400';

/** 排名颜色：前三名高亮 */
const rankColor = (rank: number) =>
  rank === 1 ? 'text-yellow-400'
    : rank === 2 ? 'text-gray-300'
      : rank === 3 ? 'text-amber-600'
        : 'text-terminal-dim';

export default function PotentialLimitUp() {
  const [data, setData] = useState<ScannerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.scanner()
      .then(setData)
      .catch((e) => setError(e?.message ?? '请求失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <div className="animate-pulse mb-3 flex justify-center">
            <Target size={36} className="text-terminal-accent/50" />
          </div>
          <p className="text-sm">正在扫描涨停潜力股...</p>
          <p className="text-xs text-terminal-dim/60 mt-1">潜力榜数据加载中</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-red-400">数据加载失败</p>
          <p className="text-xs text-terminal-dim/60 mt-1">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError('');
              api.scanner()
                .then(setData)
                .catch((e) => setError(e?.message ?? '请求失败'))
                .finally(() => setLoading(false));
            }}
            className="mt-3 px-3 py-1 text-xs bg-terminal-accent/20 text-terminal-accent rounded hover:bg-terminal-accent/30"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.ranking.length) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <Target size={32} className="mx-auto mb-2 text-terminal-dim/50" />
          <p className="text-sm">今日暂无涨停潜力数据</p>
          <p className="text-xs text-terminal-dim/60 mt-1">
            交易日 {data?.trade_date || '—'} · 市场可能尚未开盘或数据延迟
          </p>
        </div>
      </div>
    );
  }

  // 按总分降序取前 60 名
  const top: ScoredRecord[] = [...data.ranking]
    .sort((a, b) => b.total_score - a.total_score)
    .slice(0, 60);

  const goDetail = (code: string) =>
    window.dispatchEvent(new CustomEvent('navigate-detail', { detail: { code } }));

  return (
    <div className="p-6 space-y-4">
      {/* ---- 页头：环境 + 策略 ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={22} className="text-yellow-400" />
            涨停潜力榜
          </h1>
          <p className="text-sm text-terminal-dim">
            {data.trade_date} · 候选 {data.total_candidates} 只 · 展示 Top {top.length} 潜力股
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-terminal-card border border-terminal-border text-terminal-dim">
            环境 <span className="text-terminal-accent font-medium">{data.environment}</span>
          </span>
          <span className="px-2 py-1 rounded bg-terminal-card border border-terminal-border text-terminal-dim">
            策略 <span className="text-terminal-accent font-medium">{data.active_strategy}</span>
          </span>
        </div>
      </div>

      {/* ---- 卡片网格 ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {top.map((r, i) => {
          const rank = i + 1;
          return (
            <div
              key={r.code}
              onClick={() => goDetail(r.code)}
              className="panel p-4 hover:border-terminal-accent/40 transition-colors cursor-pointer"
            >
              {/* 头部：排名 / 名称代码 / 连板 / 价格 */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-lg font-bold font-mono ${rankColor(rank)}`}>
                    #{rank}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-terminal-text truncate">{r.name}</div>
                    <div className="text-xs text-terminal-dim font-mono">{r.code}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="badge-up">{r.boards}板</span>
                  <span className="text-sm text-terminal-text font-mono">¥{r.price.toFixed(2)}</span>
                </div>
              </div>

              {/* 双评级 + 总分 */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <DualGradeBadge
                  absGrade={r.abs_grade}
                  relGrade={r.rel_grade}
                  percentile={r.percentile}
                />
                <div className="text-right">
                  <div className={`text-2xl font-bold font-mono leading-none ${scoreColor(r.abs_grade)}`}>
                    {r.total_score.toFixed(1)}
                  </div>
                  <div className="text-[10px] text-terminal-dim mt-0.5">总分</div>
                </div>
              </div>

              {/* 5 维分项得分 */}
              <ScoreBar scores={r.sub_scores} compact />

              {/* 一句话理由 */}
              <div className="mt-3 pt-3 border-t border-terminal-border/50">
                <p className="text-xs text-terminal-dim truncate" title={r.reason}>
                  {r.reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- 页脚说明 ---- */}
      <div className="text-[11px] text-terminal-dim/60 flex items-center gap-1.5">
        <AlertTriangle size={12} />
        <span>以上榜单基于市场快照自动生成，仅供参考，不构成投资建议。</span>
      </div>
    </div>
  );
}
