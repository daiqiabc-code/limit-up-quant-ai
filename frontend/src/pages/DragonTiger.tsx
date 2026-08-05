import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function DragonTiger() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.dragon().then(setData); }, []);

  if (!data) return <div className="p-6 text-terminal-dim">加载中...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">龙虎榜分析</h1>
        <p className="text-sm text-terminal-dim">{data.trade_date} · 共 {data.records?.length || 0} 条席位记录</p>
      </div>

      {/* 席位汇总 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">席位净买入排行</h2></div>
        <div className="panel-body">
          <table className="data-table w-full">
            <thead><tr><th>席位</th><th>标签</th><th>类型</th><th>总买入</th><th>总卖出</th><th>净买入</th><th>操作股票</th></tr></thead>
            <tbody>
              {(data.seats_summary || []).slice(0, 15).map((s: any, i: number) => (
                <tr key={i}>
                  <td className="text-xs">{s.seat}</td>
                  <td className="text-xs text-terminal-accent">{s.tag || '—'}</td>
                  <td className="text-xs">{s.type}</td>
                  <td className="text-xs text-red-400">{(s.total_buy / 1e8).toFixed(2)}亿</td>
                  <td className="text-xs text-green-400">{(s.total_sell / 1e8).toFixed(2)}亿</td>
                  <td className={s.net >= 0 ? 'text-red-400 text-xs font-bold' : 'text-green-400 text-xs'}>
                    {(s.net / 1e8).toFixed(2)}亿
                  </td>
                  <td className="text-xs font-mono">{s.stocks?.slice(0, 3).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
