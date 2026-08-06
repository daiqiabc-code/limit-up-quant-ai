import { useEffect, useState } from 'react';
import { api, type IndustryAnalysisSnapshot } from '../lib/api';

type SortKey = 'name' | 'count' | 'total_amount' | 'avg_change';
type SortDir = 'asc' | 'desc';

export default function IndustryAnalysis() {
  const [data, setData] = useState<IndustryAnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.industry()
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

  if (!data.industries || data.industries.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-bold">行业分析</h1>
        <div className="panel p-8 text-center text-terminal-dim">暂无行业分析数据</div>
      </div>
    );
  }

  const industries = [...data.industries].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name, 'zh');
    else cmp = (a[sortKey] as number) - (b[sortKey] as number);
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '');

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold">行业分析</h1>
        <p className="text-sm text-terminal-dim mt-1">
          {data.trade_date} · 共 {industries.length} 个行业 · 点击表头排序
        </p>
      </div>
      <div className="panel overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('name')}>行业名{arrow('name')}</th>
              <th className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('count')}>涨停数{arrow('count')}</th>
              <th className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('total_amount')}>成交额{arrow('total_amount')}</th>
              <th className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort('avg_change')}>平均涨幅{arrow('avg_change')}</th>
              <th>领涨股</th>
            </tr>
          </thead>
          <tbody>
            {industries.map(ind => (
              <tr key={ind.name}>
                <td className="font-medium">{ind.name}</td>
                <td className="font-mono font-bold text-terminal-accent">{ind.count}</td>
                <td className="font-mono">{(ind.total_amount / 1e8).toFixed(2)}亿</td>
                <td className={`font-mono ${ind.avg_change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {ind.avg_change >= 0 ? '+' : ''}{ind.avg_change.toFixed(2)}%
                </td>
                <td className="text-xs">
                  {ind.leaders && ind.leaders.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {ind.leaders.map(l => (
                        <span key={l.code} className="inline-flex items-center gap-1 bg-terminal-card/60 rounded px-1.5 py-0.5">
                          <span>{l.name}</span>
                          {l.boards > 0 && <span className="text-red-400 font-mono">{l.boards}板</span>}
                        </span>
                      ))}
                    </div>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
