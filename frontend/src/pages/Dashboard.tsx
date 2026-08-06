import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Zap, AlertTriangle, DollarSign,
  BarChart3, Gauge, Smile, Wallet, RefreshCw, Activity, Flame,
} from 'lucide-react';
import { api, DashboardSnapshot, HealthWorldSnapshot } from '../lib/api';

export default function Dashboard() {
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [world, setWorld] = useState<HealthWorldSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([api.dashboard(), api.healthWorld()])
      .then(([d, w]) => { setData(d); setWorld(w); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : '数据加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  const s = data.snapshot;
  const north = s.north_capital;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-terminal-text">总览看板</h1>
          <p className="text-sm text-terminal-dim mt-1">
            {s.trade_date} · 情绪周期：
            <span className="text-terminal-accent font-medium">{s.cycle}</span>
            {' · '}数据更新：{data.data_time}
          </p>
        </div>
        <button onClick={load} className="btn-primary inline-flex items-center gap-1.5">
          <RefreshCw size={14} /> 刷新数据
        </button>
      </div>

      {/* KPI 卡片行 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp size={16} />} label="涨停数" value={s.limit_up_count} color="text-red-400" />
        <KpiCard icon={<Zap size={16} />} label="连板数" value={s.consecutive_count} color="text-terminal-accent" />
        <KpiCard icon={<BarChart3 size={16} />} label="最高连板" value={`${s.max_boards}板`} color="text-yellow-400" />
        <KpiCard icon={<AlertTriangle size={16} />} label="炸板率" value={`${s.break_rate.toFixed(1)}%`} color="text-orange-400" />
        <KpiCard icon={<TrendingDown size={16} />} label="跌停数" value={s.limit_down_count} color="text-green-400" />
        <KpiCard icon={<DollarSign size={16} />} label="成交额(亿)" value={s.total_amount.toFixed(0)} color="text-terminal-accent" />
      </div>

      {/* KPI 卡片行 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="上涨家数" value={s.up_count} color="text-red-400" />
        <KpiCard label="下跌家数" value={s.down_count} color="text-green-400" />
        <KpiCard icon={<Gauge size={16} />} label="情绪指数" value={s.sentiment_index.toFixed(0)} color="text-terminal-accent" />
        <KpiCard icon={<Smile size={16} />} label="赚钱效应" value={`${s.profit_effect.toFixed(1)}%`} color="text-red-400" />
        <KpiCard
          label="北向资金(亿)"
          value={`${north >= 0 ? '+' : ''}${north.toFixed(1)}`}
          color={north >= 0 ? 'text-red-400' : 'text-green-400'}
        />
        <KpiCard icon={<Wallet size={16} />} label="融资余额(亿)" value={s.margin_balance.toFixed(0)} color="text-terminal-accent" />
      </div>

      {/* 当前市场环境 */}
      {world && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-terminal-text inline-flex items-center gap-2">
              <Activity size={15} className="text-terminal-accent" /> 当前市场环境
            </h2>
            <span className="text-[10px] text-terminal-dim">置信因子 {world.confidence_factor.toFixed(2)}</span>
          </div>
          <div className="panel-body space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-terminal-accent/15 text-terminal-accent border border-terminal-accent/30">
                {world.environment}
              </span>
              <span className="text-sm text-terminal-dim">{world.env_description}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <EnvSignal label="涨停数" value={world.signals.zt_count} color="text-red-400" />
              <EnvSignal label="最高板" value={`${world.signals.max_boards}板`} color="text-yellow-400" />
              <EnvSignal label="连板占比" value={`${(world.signals.board_ratio * 100).toFixed(1)}%`} color="text-terminal-accent" />
              <EnvSignal label="跌停数" value={world.signals.limit_down_count} color="text-green-400" />
            </div>
          </div>
        </div>
      )}

      {/* 指数行情 & 热点板块 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 指数行情 */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-terminal-text">指数行情</h2>
          </div>
          <div className="panel-body">
            {Object.keys(s.index_quotes || {}).length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(s.index_quotes).map(([name, v]) => (
                  <div key={name} className="text-center kpi-card">
                    <div className="text-xs text-terminal-dim mb-1">{name}</div>
                    <div className="text-xl font-mono font-bold text-terminal-text">
                      {Number(v).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-terminal-dim">暂无指数数据</div>
            )}
          </div>
        </div>

        {/* 热点板块 */}
        <div className="panel">
          <div className="panel-header">
            <h2 className="text-sm font-semibold text-terminal-text inline-flex items-center gap-2">
              <Flame size={15} className="text-orange-400" /> 热点板块 TOP {s.hot_sectors?.length || 0}
            </h2>
          </div>
          <div className="panel-body">
            {(s.hot_sectors || []).length > 0 ? (
              <div className="space-y-2">
                {s.hot_sectors.map((hs, i) => (
                  <div key={hs.name} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-terminal-dim w-5 shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-terminal-text truncate">{hs.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-24 h-1.5 bg-terminal-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-terminal-accent rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, hs.heat * 100))}%` }}
                        />
                      </div>
                      <span className="text-xs text-red-400 w-16 text-right">{hs.limit_up_count}只涨停</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-terminal-dim">暂无热点板块数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, label, value, color,
}: { icon?: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="kpi-card">
      <div className="flex items-center gap-2 text-terminal-dim mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className={`kpi-value ${color}`}>{value}</div>
    </div>
  );
}

function EnvSignal({
  label, value, color,
}: { label: string; value: string | number; color: string }) {
  return (
    <div className="kpi-card">
      <div className="text-xs text-terminal-dim mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}
