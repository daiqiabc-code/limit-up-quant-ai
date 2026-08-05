import { useEffect, useState } from 'react';
import { api, LimitUpRecord } from '../lib/api';

export default function LimitUpList() {
  const [records, setRecords] = useState<LimitUpRecord[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('boards');
  const [search, setSearch] = useState('');

  useEffect(() => { api.limitup().then(d => { setRecords(d.records); setDate(d.trade_date); setLoading(false); }); }, []);

  const filtered = records
    .filter(r => !search || r.name.includes(search) || r.code.includes(search))
    .sort((a, b) => {
      switch (sort) {
        case 'boards': return b.boards - a.boards;
        case 'amount': return b.amount - a.amount;
        case 'seal_time': return a.seal_time.localeCompare(b.seal_time);
        case 'turnover': return b.turnover - a.turnover;
        default: return b.boards - a.boards;
      }
    });

  if (loading) return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">昨日涨停列表</h1>
          <p className="text-sm text-terminal-dim">{date} · 共 {records.length} 只涨停</p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索股票代码/名称..."
            className="bg-terminal-card border border-terminal-border rounded px-3 py-1.5 text-sm text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-accent/50" />
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="bg-terminal-card border border-terminal-border rounded px-2 py-1.5 text-sm text-terminal-text">
            <option value="boards">连板高度</option>
            <option value="amount">成交额</option>
            <option value="seal_time">封板时间</option>
            <option value="turnover">换手率</option>
          </select>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>代码</th><th>名称</th><th>行业</th><th>题材</th><th>涨幅</th>
              <th>连板</th><th>成交额</th><th>换手率</th><th>封板时间</th>
              <th>炸板</th><th>封单/成交</th><th>主力净流入</th><th>龙虎榜</th><th>市值</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.code} className="cursor-pointer hover:bg-terminal-accent/5"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-detail', { detail: { code: r.code } }))}>
                <td className="font-mono text-xs">{r.code}</td>
                <td className="font-medium">{r.name}</td>
                <td className="text-xs">{r.industry}</td>
                <td className="text-xs">{r.concepts?.slice(0, 2).join('/')}</td>
                <td className="text-red-400">+{r.pct_chg}%</td>
                <td><span className={`font-bold ${r.boards >= 3 ? 'text-yellow-400' : ''}`}>{r.boards}板</span></td>
                <td className="text-xs">{(r.amount / 1e8).toFixed(1)}亿</td>
                <td className="text-xs">{r.turnover.toFixed(1)}%</td>
                <td className="text-xs">{r.seal_time}</td>
                <td className="text-xs">{r.break_times > 0 ? <span className="text-orange-400">{r.break_times}次</span> : '—'}</td>
                <td className="text-xs">{r.seal_ratio.toFixed(2)}</td>
                <td className={r.main_net_inflow >= 0 ? 'text-red-400 text-xs' : 'text-green-400 text-xs'}>
                  {(r.main_net_inflow / 1e8).toFixed(2)}亿
                </td>
                <td className="text-xs">{r.has_dragon ? '✅' : '—'}</td>
                <td className="text-xs">{r.float_mv.toFixed(1)}亿</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
