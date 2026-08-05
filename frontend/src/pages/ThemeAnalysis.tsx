import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function ThemeAnalysis() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.theme().then(setData); }, []);

  if (!data) return <div className="p-6 text-terminal-dim">加载中...</div>;

  const maxCount = Math.max(1, ...data.themes.map((t: any) => t.count));

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">题材分析</h1>
      <p className="text-sm text-terminal-dim mb-4">{data.trade_date} · 共 {data.themes.length} 个题材</p>
      <div className="panel">
        <table className="data-table w-full">
          <thead>
            <tr><th>题材</th><th>涨停数量</th><th>龙头</th><th>热度</th></tr>
          </thead>
          <tbody>
            {data.themes.map((t: any) => (
              <tr key={t.name}>
                <td className="font-medium">{t.name}</td>
                <td className="font-bold text-terminal-accent">{t.count}</td>
                <td className="font-mono text-xs">{t.leader}</td>
                <td>
                  <div className="w-32 h-2 bg-terminal-border rounded-full">
                    <div className="h-full bg-terminal-accent rounded-full" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
