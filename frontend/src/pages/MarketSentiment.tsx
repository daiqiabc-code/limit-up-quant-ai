import { useEffect, useState } from 'react';
import { api, type HealthWorldSnapshot, type DashboardSnapshot } from '../lib/api';

/** 五维维度中文映射 */
const DIM_CN: Record<string, string> = {
  board_strength: '连板强度',
  seal_quality: '封单质量',
  sector_position: '板块地位',
  theme_freshness: '题材新鲜度',
  volume_health: '量价健康',
};

/** 按环境名称推断配色（A 股语义：涨/亢奋=红，退/跌=绿，冰点=蓝） */
function envStyle(env: string): string {
  if (/牛市|亢奋|高潮|过热|狂热|强势/.test(env)) {
    return 'text-red-400 border-red-400/40 bg-red-400/10';
  }
  if (/冰|缩量|寒|冷/.test(env)) {
    return 'text-blue-400 border-blue-400/40 bg-blue-400/10';
  }
  if (/退|衰|崩|跌|恐慌|弱/.test(env)) {
    return 'text-green-400 border-green-400/40 bg-green-400/10';
  }
  if (/活|复|升|暖|强/.test(env)) {
    return 'text-terminal-accent border-terminal-accent/40 bg-terminal-accent/10';
  }
  return 'text-yellow-400 border-yellow-400/40 bg-yellow-400/10';
}

function cycleColor(cycle: string): string {
  if (/高潮|亢奋|过热/.test(cycle)) return 'text-red-400';
  if (/冰|寒|冷/.test(cycle)) return 'text-blue-400';
  if (/退|衰|跌/.test(cycle)) return 'text-green-400';
  return 'text-terminal-accent';
}

export default function MarketSentiment() {
  const [world, setWorld] = useState<HealthWorldSnapshot | null>(null);
  const [dash, setDash] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([api.healthWorld(), api.dashboard()])
      .then(([w, d]) => {
        setWorld(w);
        setDash(d);
      })
      .catch(e => setError(e?.message || '数据加载失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-400">数据加载失败：{error}</div>;
  }
  if (!world) {
    return <div className="p-6 text-terminal-dim">暂无市场环境数据</div>;
  }

  const sig = world.signals;
  const snap = dash?.snapshot;
  const curStyle = envStyle(world.environment);
  const curTextCls = curStyle.split(' ')[0];

  const signals = [
    { label: '涨停数', value: `${sig.zt_count}`, color: 'text-red-400' },
    { label: '最高连板', value: `${sig.max_boards}板`, color: 'text-yellow-400' },
    { label: '连板占比', value: `${(sig.board_ratio * 100).toFixed(1)}%`, color: 'text-terminal-accent' },
    { label: '跌停数', value: `${sig.limit_down_count}`, color: 'text-green-400' },
    { label: '炸板率', value: `${(sig.break_rate * 100).toFixed(1)}%`, color: 'text-orange-400' },
    { label: '平均换手', value: `${sig.avg_turnover.toFixed(1)}%`, color: 'text-terminal-text' },
  ];

  const adjustments = Object.entries(world.weight_adjustments);
  const maxAdj = Math.max(1, ...adjustments.map(([, v]) => v));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">市场情绪</h1>

      {/* 当前环境（大色块） */}
      <div className={`rounded-lg border p-5 ${curStyle}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-xs text-terminal-dim">当前市场环境</div>
            <div className={`text-3xl font-bold mt-1 ${curTextCls}`}>{world.environment}</div>
            <div className="text-sm text-terminal-text/80 mt-2 max-w-2xl">{world.env_description}</div>
          </div>
          <div className="text-left md:text-right">
            <div className="text-xs text-terminal-dim">置信系数</div>
            <div className="text-2xl font-bold font-mono text-terminal-text">{world.confidence_factor.toFixed(3)}</div>
          </div>
        </div>
      </div>

      {/* 仪表盘市场数据 */}
      {snap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="kpi-card">
            <div className="kpi-label">情绪指数</div>
            <div className="kpi-value text-terminal-accent">{snap.sentiment_index.toFixed(1)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">市场温度</div>
            <div className="kpi-value text-terminal-accent">{snap.temperature}°</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">周期阶段</div>
            <div className={`kpi-value ${cycleColor(snap.cycle)}`}>{snap.cycle}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">赚钱效应</div>
            <div className="kpi-value text-red-400">{snap.profit_effect.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {/* 信号指标 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">信号指标</h2></div>
        <div className="panel-body grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {signals.map(s => (
            <div key={s.label} className="bg-terminal-card/50 rounded p-3">
              <div className="text-xs text-terminal-dim">{s.label}</div>
              <div className={`text-xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 权重调整系数 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">权重调整系数</h2></div>
        <div className="panel-body">
          <table className="data-table w-full">
            <thead>
              <tr><th>维度</th><th>调整系数</th><th className="w-1/2">相对幅度</th></tr>
            </thead>
            <tbody>
              {adjustments.map(([k, v]) => {
                const boost = v >= 1;
                const color = boost ? 'text-red-400' : 'text-green-400';
                const barColor = boost ? 'bg-red-400' : 'bg-green-400';
                const arrow = boost ? '↑' : '↓';
                return (
                  <tr key={k}>
                    <td className="font-medium">{DIM_CN[k] || k}</td>
                    <td className={`font-mono ${color}`}>{arrow} {v.toFixed(3)}</td>
                    <td>
                      <div className="h-2 bg-terminal-card rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-300`} style={{ width: `${(v / maxAdj) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="mt-3 text-xs text-terminal-dim">系数 &gt; 1 表示该维度被上调（红），&lt; 1 表示下调（绿）。</div>
        </div>
      </div>

      {/* 全部环境 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">全部市场环境（共 {world.all_envs.length} 种）</h2></div>
        <div className="panel-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {world.all_envs.map(e => {
            const isCurrent = e.name === world.environment;
            const style = envStyle(e.name);
            return (
              <div key={e.name} className={`rounded border p-3 ${isCurrent ? style : 'border-terminal-border bg-terminal-card/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${isCurrent ? style.split(' ')[0] : 'text-terminal-text'}`}>{e.name}</span>
                  {isCurrent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-terminal-accent/15 text-terminal-accent border border-terminal-accent/30">当前</span>
                  )}
                </div>
                <div className="text-xs text-terminal-dim mt-1">{e.description}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
