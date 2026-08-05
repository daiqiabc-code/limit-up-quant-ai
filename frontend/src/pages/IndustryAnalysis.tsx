import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function IndustryAnalysis() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.industry().then(setData); }, []);

  if (!data) return <div className="p-6 text-terminal-dim">加载中...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">行业分析</h1>
      <p className="text-sm text-terminal-dim mb-4">{data.trade_date} · 按涨停数量排序</p>
      <div className="grid grid-cols-2 gap-4">
        {data.industries.map((ind: any, i: number) => (
          <div key={ind.name} className="panel p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-terminal-dim">{i + 1}</span>
                <span className="font-medium">{ind.name}</span>
              </div>
              <div className="text-xs text-terminal-dim mt-1">上涨 {ind.up_count} 家</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-terminal-accent">{ind.limit_up_count}</div>
              <div className="text-xs text-terminal-dim">涨停</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
