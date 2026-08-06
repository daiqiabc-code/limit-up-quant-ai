import { useEffect, useState } from 'react';
import { api, type ThemeAnalysisSnapshot } from '../lib/api';

/**
 * 题材行（对声明类型中可能缺失的字段做可选处理，兼容快照数据）。
 * 类型声明包含 leader_code / avg_change / boards_max，实际快照可能缺省，渲染时降级为 '—'。
 */
interface ThemeRow {
  name: string;
  count: number;
  leader: string;
  leader_code?: string;
  amount: number;
  avg_change?: number;
  boards_max?: number;
}

export default function ThemeAnalysis() {
  const [data, setData] = useState<ThemeAnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.theme()
      .then(setData)
      .catch(e => setError(e?.message || '数据加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-400">数据加载失败：{error}</div>;
  }
  if (!data) return null;

  if (!data.themes || data.themes.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">题材分析</h1>
        <div className="panel p-8 text-center text-terminal-dim">暂无题材分析数据</div>
      </div>
    );
  }

  // 按涨停数降序
  const themes = (data.themes as ThemeRow[]).slice().sort((a, b) => b.count - a.count);
  const maxCount = Math.max(1, ...themes.map(t => t.count));

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">题材分析</h1>
        <p className="text-sm text-terminal-dim mt-1">
          {data.trade_date} · 共 {themes.length} 个题材 · 按涨停数降序
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((t, i) => {
          const avg = t.avg_change;
          const boards = t.boards_max;
          return (
            <div key={t.name} className="panel p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-terminal-dim font-mono">#{i + 1}</span>
                    <span className="font-semibold truncate">{t.name}</span>
                  </div>
                  <div className="text-xs text-terminal-dim mt-1">
                    龙头
                    <span className="text-terminal-text ml-1">{t.leader}</span>
                    {t.leader_code && <span className="text-terminal-dim font-mono ml-1">{t.leader_code}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-bold font-mono text-terminal-accent leading-none">{t.count}</div>
                  <div className="text-[10px] text-terminal-dim mt-0.5">涨停</div>
                </div>
              </div>

              {/* 涨停数进度条 */}
              <div className="h-1.5 bg-terminal-card rounded-full overflow-hidden">
                <div className="h-full bg-terminal-accent rounded-full transition-all duration-300" style={{ width: `${(t.count / maxCount) * 100}%` }} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-terminal-dim">最高连板</div>
                  <div className="font-mono text-yellow-400 mt-0.5">{boards != null ? `${boards}板` : '—'}</div>
                </div>
                <div>
                  <div className="text-terminal-dim">平均涨幅</div>
                  <div className={`font-mono mt-0.5 ${avg == null ? 'text-terminal-dim' : avg >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {avg == null ? '—' : `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`}
                  </div>
                </div>
                <div>
                  <div className="text-terminal-dim">成交额</div>
                  <div className="font-mono text-terminal-text mt-0.5">{(t.amount / 1e8).toFixed(2)}亿</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
