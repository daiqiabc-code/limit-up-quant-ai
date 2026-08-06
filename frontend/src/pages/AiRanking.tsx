import { useEffect, useState } from 'react';
import { Trophy, AlertTriangle } from 'lucide-react';
import { api, RankingSnapshot, ScoredRecord } from '../lib/api';
import { GradeBadge } from '../components/GradeBadge';

type FilterGrade = 'ALL' | 'S' | 'A' | 'B';
type SortKey = 'total_score' | 'boards';

/** 总分颜色：S=fuchsia / A=red / B=amber / C=sky / D=gray */
const scoreColor = (grade: string) =>
  grade === 'S' ? 'text-fuchsia-400'
    : grade === 'A' ? 'text-red-400'
    : grade === 'B' ? 'text-amber-400'
    : grade === 'C' ? 'text-sky-400'
    : 'text-gray-400';

/** 按钮：激活 / 未激活 */
const btn = (active: boolean) =>
  active
    ? 'bg-terminal-accent/30 text-terminal-accent border border-terminal-accent/50 px-3 py-1.5 rounded text-sm'
    : 'btn-primary';

export default function AiRankingPage() {
  const [data, setData] = useState<RankingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterGrade>('ALL');
  const [sort, setSort] = useState<SortKey>('total_score');

  useEffect(() => {
    api.ranking()
      .then(setData)
      .catch((e) => setError(e?.message ?? '请求失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <div className="animate-pulse mb-3 flex justify-center">
            <Trophy size={32} className="text-fuchsia-400/60" />
          </div>
          <p className="text-sm">加载 AI 接力榜中...</p>
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
              api.ranking()
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
          <Trophy size={32} className="mx-auto mb-2 text-terminal-dim/50" />
          <p className="text-sm">暂无接力榜数据</p>
          <p className="text-xs text-terminal-dim/60 mt-1">交易日 {data?.trade_date || '—'}</p>
        </div>
      </div>
    );
  }

  // 按评级过滤 + 按总分/连板排序
  const rows: ScoredRecord[] = data.ranking
    .filter((r) => filter === 'ALL' || r.abs_grade === filter)
    .sort((a, b) =>
      sort === 'total_score' ? b.total_score - a.total_score : b.boards - a.boards
    );

  const goDetail = (code: string) =>
    window.dispatchEvent(new CustomEvent('navigate-detail', { detail: { code } }));

  return (
    <div className="p-6 space-y-4">
      {/* ---- 页头：环境 + 策略 ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Trophy size={22} className="text-fuchsia-400" />
            AI 接力榜
          </h1>
          <p className="text-sm text-terminal-dim">
            {data.trade_date} · 共 {data.count} 只 · 最值得接力标的
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

      {/* ---- 过滤 + 排序 ---- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-terminal-dim">评级</span>
          {(['ALL', 'S', 'A', 'B'] as FilterGrade[]).map((g) => (
            <button key={g} onClick={() => setFilter(g)} className={btn(filter === g)}>
              {g === 'ALL' ? '全部' : `${g}级`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-terminal-dim">排序</span>
          <button onClick={() => setSort('total_score')} className={btn(sort === 'total_score')}>总分</button>
          <button onClick={() => setSort('boards')} className={btn(sort === 'boards')}>连板</button>
        </div>
      </div>

      {/* ---- 表格 ---- */}
      <div className="panel overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>排名</th>
              <th>代码/名称</th>
              <th>连板</th>
              <th>总分</th>
              <th>绝对评级</th>
              <th>相对评级</th>
              <th>百分位</th>
              <th>理由</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.code}
                className="cursor-pointer"
                onClick={() => goDetail(r.code)}
              >
                <td className="font-mono text-sm text-terminal-dim">{r.rank}</td>
                <td>
                  <div className="flex flex-col">
                    <span className="font-medium text-terminal-text">{r.name}</span>
                    <span className="font-mono text-xs text-terminal-dim">{r.code}</span>
                  </div>
                </td>
                <td>
                  <span className={`font-bold ${r.boards >= 3 ? 'text-yellow-400' : 'text-terminal-text'}`}>
                    {r.boards}板
                  </span>
                </td>
                <td>
                  <span className={`font-bold font-mono ${scoreColor(r.abs_grade)}`}>
                    {r.total_score.toFixed(1)}
                  </span>
                </td>
                <td><GradeBadge grade={r.abs_grade} type="abs" size="sm" /></td>
                <td><GradeBadge grade={r.rel_grade} type="rel" size="sm" /></td>
                <td className="font-mono text-xs text-terminal-dim">P{r.percentile}</td>
                <td className="max-w-xs">
                  <span className="block text-xs text-terminal-dim truncate" title={r.reason}>
                    {r.reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center text-terminal-dim py-8 text-sm">当前筛选条件下暂无数据</div>
        )}
      </div>

      {/* ---- 页脚说明 ---- */}
      <div className="text-[11px] text-terminal-dim/60 flex items-center gap-1.5">
        <AlertTriangle size={12} />
        <span>相对评级基于池内百分位，绝对评级基于模型概率，仅供参考，不构成投资建议。</span>
      </div>
    </div>
  );
}
