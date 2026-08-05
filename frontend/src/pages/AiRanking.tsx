import { useEffect, useState } from 'react';
import { api, AiRanking } from '../lib/api';

const probColor = (v: number) =>
  v >= 0.85 ? 'text-green-400' : v >= 0.75 ? 'text-blue-400' : v >= 0.6 ? 'text-yellow-400' : v >= 0.5 ? 'text-orange-400' : 'text-terminal-dim';

const gradeClass = (g: string) =>
  g === 'S' ? 'grade-s' : g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : g === 'C' ? 'grade-c' : 'grade-d';

export default function AiRankingPage() {
  const [data, setData] = useState<AiRanking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.ranking().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;
  if (!data) return null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">AI 排行榜</h1>
          <p className="text-sm text-terminal-dim">
            {data.trade_date} · 共 {data.count} 只 · 按继续涨停概率排序 · 评级含绝对概率 + 池内相对排名
          </p>
        </div>
        <div className="flex gap-2 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/30">
            🏆 相对评级 = 池内百分位
          </span>
        </div>
      </div>

      <div className="flex gap-2 text-xs mb-4">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background: '#34d399'}} /> S 前8%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background: '#60a5fa'}} /> A 8-20%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background: '#fbbf24'}} /> B 20-40%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background: '#fb923c'}} /> C 40-70%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{background: '#6b7280'}} /> D 后30%</span>
      </div>

      <div className="panel overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>排名</th><th>股票</th><th>代码</th><th>涨停概率</th><th>综合分</th>
              <th>排名评级</th><th>绝对评级</th><th>风险</th><th>建议</th>
            </tr>
          </thead>
          <tbody>
            {data.ranking.map(r => (
              <tr key={r.code} className="cursor-pointer hover:bg-terminal-accent/5"
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-detail', { detail: { code: r.code } }))}>
                <td className="font-mono text-sm">{r.rank}</td>
                <td className="font-medium">{r.name}</td>
                <td className="font-mono text-xs">{r.code}</td>
                <td className={`font-bold text-sm ${probColor(r.prob_limit_up)}`}>
                  {(r.prob_limit_up * 100).toFixed(1)}%
                </td>
                <td className="font-mono text-sm">{r.total_score.toFixed(1)}</td>
                <td>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${gradeClass(r.rel_grade || r.grade)}`}>
                    {r.rel_grade || r.grade}
                  </span>
                  {r.percentile != null && (
                    <span className="text-[10px] text-terminal-dim ml-1">P{r.percentile}</span>
                  )}
                </td>
                <td>
                  <span className="text-[10px] text-terminal-dim">{r.grade}</span>
                  <span className="text-[10px] text-terminal-dim/50 ml-0.5">(绝对)</span>
                </td>
                <td className={`text-xs ${
                  r.risk_level === '低' ? 'text-green-400' : r.risk_level === '中' ? 'text-yellow-400' : 'text-red-400'
                }`}>{r.risk_level}</td>
                <td className="text-xs">{r.advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
