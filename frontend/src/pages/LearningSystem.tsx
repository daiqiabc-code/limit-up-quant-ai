import { useEffect, useState } from 'react';
import { api, LearningStats } from '../lib/api';

export default function LearningSystem() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [calibData, setCalibData] = useState<any>(null);

  useEffect(() => {
    api.learningStats().then(setStats);
    api.learningLogs(30).then(d => setLogs(d.logs));
    fetch('/api/learning/calibration').then(r => r.json()).then(setCalibData).catch(() => {});
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">AI 学习系统</h1>
      <p className="text-sm text-terminal-dim">全自动预测→验证→进化闭环。当前模型：{stats?.active_model || '—'}</p>

      {stats && (
        <>
          <div className="grid grid-cols-5 gap-3">
            <Kpi v={`${(stats.accuracy * 100).toFixed(1)}%`} l="准确率" c="text-terminal-accent" />
            <Kpi v={`${(stats.top10_precision * 100).toFixed(0)}%`} l="Top10命中率" c="text-terminal-accent" />
            <Kpi v={`${(stats.top20_precision * 100).toFixed(0)}%`} l="Top20命中率" />
            <Kpi v={`${(stats.win_rate * 100).toFixed(0)}%`} l="胜率" c="text-red-400" />
            <Kpi v={stats.profit_loss_ratio.toFixed(2)} l="盈亏比" />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Kpi v={`${stats.max_drawdown}%`} l="最大回撤" c="text-green-400" />
            <Kpi v={`${stats.cumulative_return}%`} l="累计收益" c={stats.cumulative_return >= 0 ? 'text-red-400' : 'text-green-400'} />
            <Kpi v={stats.total_predictions} l="总预测数" />
            <Kpi v={stats.verified_count} l="已验证" />
            <Kpi v={stats.model_versions.length} l="模型版本" c="text-terminal-accent" />
          </div>

          {/* 模型版本历史 */}
          <div className="panel">
            <div className="panel-header"><h2 className="text-sm font-semibold">模型版本进化</h2></div>
            <div className="panel-body">
              <table className="data-table w-full">
                <thead><tr><th>版本</th><th>训练时间</th><th>准确率</th><th>Brier</th><th>样本数</th></tr></thead>
                <tbody>
                  {stats.model_versions.map(v => (
                    <tr key={v.version}>
                      <td className="text-terminal-accent font-bold">{v.version}</td>
                      <td className="text-xs">{v.trained_at}</td>
                      <td className="text-sm">{(v.accuracy * 100).toFixed(1)}%</td>
                      <td className="text-xs">{v.brier.toFixed(4)}</td>
                      <td className="text-xs">{v.samples}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 学习日志 */}
      {logs.length > 0 && (
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">学习日志</h2></div>
          <div className="panel-body space-y-2 max-h-64 overflow-y-auto">
            {logs.map(l => (
              <div key={l.id} className="flex items-start gap-3 text-sm p-2 bg-terminal-card/30 rounded">
                <span className={`text-xs font-bold ${
                  l.event === 'verify' ? 'text-blue-400' : l.event === 'retrain' ? 'text-green-400' : 'text-terminal-dim'
                }`}>[{l.event}]</span>
                <div className="flex-1">
                  <div className="text-xs">{l.summary}</div>
                  <div className="text-xs text-terminal-dim">{l.trade_date} · {l.created_at}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ v, l, c }: { v: string | number; l: string; c?: string }) {
  return (
    <div className="kpi-card text-center">
      <div className={`kpi-value ${c || 'text-terminal-text'}`}>{v}</div>
      <div className="kpi-label">{l}</div>
    </div>
  );
}
