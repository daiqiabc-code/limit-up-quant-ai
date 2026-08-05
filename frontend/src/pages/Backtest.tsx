import { useEffect, useState } from 'react';
import { api, BacktestResult } from '../lib/api';

export default function Backtest() {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.dates().then(d => setDates(d.dates)); }, []);

  const run = async (date?: string) => {
    setLoading(true);
    try {
      const r = await api.backtest(date || undefined);
      setData(r);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { run(); }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">历史回测</h1>
          <p className="text-sm text-terminal-dim">验证 AI 预测准确率</p>
        </div>
        <div className="flex gap-2">
          <select value={selected} onChange={e => { setSelected(e.target.value); run(e.target.value); }}
            className="bg-terminal-card border border-terminal-border rounded px-3 py-1.5 text-sm">
            <option value="">最新</option>
            {dates.slice(0, 50).map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={() => run(selected)} className="btn-primary" disabled={loading}>
            {loading ? '分析中...' : '执行回测'}
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-6 gap-3">
            <KpiBox label="预测总数" value={data.total} />
            <KpiBox label="次日涨停" value={data.limit_up_count} color="text-red-400" />
            <KpiBox label="上涨数量" value={data.up_count} color="text-red-400" />
            <KpiBox label="平均收益" value={`${data.avg_return}%`} color={data.avg_return >= 0 ? 'text-red-400' : 'text-green-400'} />
            <KpiBox label="Top10命中率" value={`${(data.top10_precision * 100).toFixed(0)}%`} color="text-terminal-accent" />
            <KpiBox label="胜率" value={`${(data.win_rate * 100).toFixed(0)}%`} color="text-red-400" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <KpiBox label="Top20命中率" value={`${(data.top20_precision * 100).toFixed(0)}%`} color="text-terminal-accent" />
            <KpiBox label="盈亏比" value={data.profit_loss_ratio.toFixed(2)} />
            <KpiBox label="最大回撤" value={`${data.max_drawdown}%`} color="text-green-400" />
            <KpiBox label="累计收益" value={`${data.cumulative_return}%`} color={data.cumulative_return >= 0 ? 'text-red-400' : 'text-green-400'} />
            <div className="kpi-card flex flex-col items-start justify-end">
              <span className="text-xs text-terminal-dim">{data.trade_date} → {data.next_date}</span>
            </div>
          </div>

          <div className="panel overflow-x-auto">
            <div className="panel-header"><h2 className="text-sm font-semibold">回测明细</h2></div>
            <table className="data-table w-full">
              <thead><tr><th>排名</th><th>代码</th><th>名称</th><th>预测概率</th><th>评级</th><th>实际涨跌幅</th><th>是否涨停</th><th>命中</th></tr></thead>
              <tbody>
                {data.results.map(r => (
                  <tr key={r.code}>
                    <td className="text-xs">{r.rank}</td>
                    <td className="font-mono text-xs">{r.code}</td>
                    <td className="font-medium text-sm">{r.name}</td>
                    <td className="text-sm">{(r.prob_limit_up * 100).toFixed(0)}%</td>
                    <td><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      r.grade === 'S' ? 'grade-s' : r.grade === 'A' ? 'grade-a' : 'grade-b'
                    }`}>{r.grade}</span></td>
                    <td className={r.actual_pct >= 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                      {r.actual_pct >= 0 ? '+' : ''}{r.actual_pct.toFixed(2)}%
                    </td>
                    <td>{r.actual_limit_up ? <span className="text-red-400 font-bold">涨停</span> : <span className="text-terminal-dim">—</span>}</td>
                    <td>{r.hit ? <span className="text-green-400">✓</span> : <span className="text-red-400">✗</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KpiBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="kpi-card text-center">
      <div className={`kpi-value ${color || 'text-terminal-text'}`}>{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
