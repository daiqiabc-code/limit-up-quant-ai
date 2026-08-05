import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Zap, AlertTriangle, DollarSign, BarChart3 } from 'lucide-react';
import { api, DashboardData } from '../lib/api';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-terminal-dim">加载中...</div>;
  if (!data) return <div className="flex items-center justify-center h-full text-terminal-red">数据加载失败</div>;

  const s = data.snapshot;

  return (
    <div className="p-6 space-y-6">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-terminal-dim">
            {s.trade_date} · 情绪周期: <span className="text-terminal-accent font-medium">{s.cycle}</span> · 数据更新时间: {data.data_time}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); api.dashboard().then(setData).finally(() => setLoading(false)); }}
            className="btn-primary">刷新数据</button>
        </div>
      </div>

      {/* KPI 卡片行 1 */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard icon={<TrendingUp size={16} />} label="昨日涨停" value={s.limit_up_count} color="text-red-400" />
        <KpiCard icon={<Zap size={16} />} label="连板数量" value={s.consecutive_count} color="text-terminal-accent" />
        <KpiCard icon={<BarChart3 size={16} />} label="最高连板" value={`${s.max_boards}板`} color="text-yellow-400" />
        <KpiCard icon={<AlertTriangle size={16} />} label="炸板率" value={`${s.break_rate}%`} color="text-orange-400" />
        <KpiCard icon={<TrendingDown size={16} />} label="跌停数量" value={s.limit_down_count} color="text-green-400" />
        <KpiCard icon={<DollarSign size={16} />} label="成交额(亿)" value={s.total_amount.toFixed(0)} color="text-terminal-accent" />
      </div>

      {/* KPI 卡片行 2 */}
      <div className="grid grid-cols-6 gap-3">
        <KpiCard label="上涨家数" value={s.up_count} color="text-red-400" />
        <KpiCard label="下跌家数" value={s.down_count} color="text-green-400" />
        <KpiCard label="市场情绪指数" value={`${s.sentiment_index}°`} color="text-terminal-accent" />
        <KpiCard label="赚钱效应" value={`${s.profit_effect}%`} color="text-red-400" />
        <KpiCard label="北向资金(亿)" value={s.north_capital > 0 ? `+${s.north_capital.toFixed(1)}` : s.north_capital.toFixed(1)} color={s.north_capital >= 0 ? 'text-red-400' : 'text-green-400'} />
        <KpiCard label="融资余额(亿)" value={s.margin_balance.toFixed(0)} color="text-terminal-dim" />
      </div>

      {/* 指数行情 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">指数行情</h2></div>
        <div className="panel-body">
          <div className="flex gap-8">
            {Object.entries(s.index_quotes || {}).map(([name, v]) => (
              <div key={name} className="text-center">
                <div className="text-xs text-terminal-dim">{name}</div>
                <div className="text-xl font-mono font-bold">{Number(v).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 热点概念 & 资金流 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">热点概念 TOP 6</h2></div>
          <div className="panel-body">
            <div className="space-y-2">
              {(s.hot_sectors || []).map((hs, i) => (
                <div key={hs.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-terminal-dim w-5">{i + 1}</span>
                    <span className="text-sm font-medium">{hs.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32 h-1.5 bg-terminal-border rounded-full overflow-hidden">
                      <div className="h-full bg-terminal-accent rounded-full" style={{ width: `${hs.heat * 100}%` }} />
                    </div>
                    <span className="text-xs text-terminal-dim">{hs.limit_up_count}只涨停</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">资金面</h2></div>
          <div className="panel-body space-y-3">
            <div className="flex justify-between"><span className="text-sm text-terminal-dim">两市净流入</span><span className={s.net_capital >= 0 ? 'text-red-400' : 'text-green-400'}>{s.net_capital >= 0 ? '+' : ''}{s.net_capital}亿</span></div>
            <div className="flex justify-between"><span className="text-sm text-terminal-dim">北向资金</span><span className={s.north_capital >= 0 ? 'text-red-400' : 'text-green-400'}>{s.north_capital >= 0 ? '+' : ''}{s.north_capital}亿</span></div>
            <div className="flex justify-between"><span className="text-sm text-terminal-dim">融资余额</span><span>{s.margin_balance}亿</span></div>
            <div className="flex justify-between"><span className="text-sm text-terminal-dim">赚钱效应</span><span className="text-red-400">{s.profit_effect}%</span></div>
            <div className="flex justify-between"><span className="text-sm text-terminal-dim">市场温度</span>
              <span className={
                s.temperature >= 60 ? 'text-red-400' : s.temperature >= 30 ? 'text-yellow-400' : 'text-green-400'
              }>{s.temperature}°</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon?: React.ReactNode; label: string; value: string | number; color: string }) {
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
