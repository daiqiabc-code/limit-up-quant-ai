import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { api, LimitUpSnapshot, LimitUpRecord } from '../lib/api';

type SortKey = 'code' | 'name' | 'limit_price' | 'fb_count' | 'fd_amount' | 'reason' | 'industry';
type SortDir = 'asc' | 'desc';

export default function LimitUpList() {
  const [data, setData] = useState<LimitUpSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fb_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const load = () => {
    setLoading(true);
    setError('');
    api.limitup()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '数据加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  const rows = useMemo<LimitUpRecord[]>(() => {
    if (!data) return [];
    const kw = search.trim().toLowerCase();
    const filtered = kw
      ? data.records.filter(
          (r) => r.code.toLowerCase().includes(kw) || r.name.toLowerCase().includes(kw),
        )
      : data.records;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const diff = (av as number) - (bv as number);
      return sortDir === 'asc' ? diff : -diff;
    });
    return sorted;
  }, [data, search, sortKey, sortDir]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-terminal-dim">加载中...</div>;
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <div className="text-terminal-red">{error}</div>
        <button onClick={load} className="btn-primary inline-flex items-center gap-1.5">
          <RefreshCw size={14} /> 重试
        </button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* 顶部标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-terminal-text">涨停列表</h1>
          <p className="text-sm text-terminal-dim mt-1">
            {data.trade_date} · 共 <span className="text-red-400 font-medium">{data.count}</span> 只涨停
            {search.trim() && (
              <span className="ml-1">· 筛选结果 {rows.length} 只</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-terminal-dim" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索代码 / 名称..."
              className="bg-terminal-card border border-terminal-border rounded pl-8 pr-3 py-1.5 text-sm text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-accent/50 w-44 sm:w-56"
            />
          </div>
          <button onClick={load} className="btn-primary inline-flex items-center gap-1.5">
            <RefreshCw size={14} /> 刷新
          </button>
        </div>
      </div>

      {/* 涨停表格 */}
      <div className="panel overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <SortableTh label="代码" k="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="名称" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="涨停价" k="limit_price" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="连板" k="fb_count" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="封单(万)" k="fd_amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
              <SortableTh label="原因" k="reason" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="行业" k="industry" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.code}>
                  <td>
                    <button
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent('navigate-detail', { detail: { code: r.code } }),
                        )
                      }
                      className="font-mono text-xs text-terminal-accent hover:underline"
                    >
                      {r.code}
                    </button>
                  </td>
                  <td className="font-medium text-terminal-text">{r.name}</td>
                  <td className="text-right font-mono text-red-400">{r.limit_price.toFixed(2)}</td>
                  <td className="text-right">
                    <span className={`font-bold ${r.fb_count >= 2 ? 'text-red-400' : 'text-terminal-text'}`}>
                      {r.fb_count}板
                    </span>
                  </td>
                  <td className="text-right font-mono text-terminal-text">¥{r.fd_amount.toFixed(2)}万</td>
                  <td className="text-xs text-terminal-dim max-w-xs truncate" title={r.reason}>
                    {r.reason || '—'}
                  </td>
                  <td className="text-xs text-terminal-dim">{r.industry || '—'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-terminal-dim py-8">
                  {search.trim() ? '未匹配到符合条件的股票' : '暂无涨停数据'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label, k, sortKey, sortDir, onSort, align = 'left',
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={`cursor-pointer select-none whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
    >
      <span className={`inline-flex items-center gap-1 ${active ? 'text-terminal-accent' : ''}`}>
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="text-terminal-dim/60" />
        )}
      </span>
    </th>
  );
}
