import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import ReactECharts from 'echarts-for-react';

export default function MarketSentiment() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.sentiment().then(setData); }, []);

  if (!data) return <div className="p-6 text-terminal-dim">加载中...</div>;

  const s = data.current;
  const tl = data.timeline || [];

  const tempOption = {
    backgroundColor: '#0a0a12',
    grid: { left: '8%', right: '4%', top: '10%', bottom: '10%' },
    xAxis: { type: 'category', data: tl.map((t: any) => t.date.slice(5)), axisLabel: { color: '#6b6b80', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e1e3a' } } },
    yAxis: { type: 'value', axisLabel: { color: '#6b6b80' }, splitLine: { lineStyle: { color: '#1e1e3a', type: 'dashed' } } },
    series: [
      { type: 'line', data: tl.map((t: any) => t.temp), smooth: true, lineStyle: { color: '#00d4ff', width: 2 }, areaStyle: { color: 'rgba(0,212,255,0.08)' }, symbol: 'none' },
      { type: 'line', data: tl.map((t: any) => t.profit), smooth: true, lineStyle: { color: '#ff5252', width: 1.5 }, symbol: 'none' },
    ],
    tooltip: { trigger: 'axis' },
  };

  const barOption = {
    backgroundColor: '#0a0a12',
    grid: { left: '8%', right: '4%', top: '10%', bottom: '10%' },
    xAxis: { type: 'category', data: tl.map((t: any) => t.date.slice(5)), axisLabel: { color: '#6b6b80', fontSize: 10 }, axisLine: { lineStyle: { color: '#1e1e3a' } } },
    yAxis: { type: 'value', axisLabel: { color: '#6b6b80' }, splitLine: { lineStyle: { color: '#1e1e3a', type: 'dashed' } } },
    series: [
      { type: 'bar', data: tl.map((t: any) => t.limit_up), itemStyle: { color: '#ff5252' }, name: '涨停' },
      { type: 'bar', data: tl.map((t: any) => t.limit_down), itemStyle: { color: '#00e676' }, name: '跌停' },
    ],
    tooltip: { trigger: 'axis' },
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">市场情绪</h1>

      <div className="grid grid-cols-5 gap-3">
        <div className="kpi-card">
          <div className="text-xs text-terminal-dim">周期阶段</div>
          <div className={`kpi-value ${
            s.cycle === '高潮' ? 'text-red-400' : s.cycle === '冰点' ? 'text-blue-400' : s.cycle === '退潮' ? 'text-green-400' : 'text-terminal-accent'
          }`}>{s.cycle}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-terminal-dim">市场温度</div>
          <div className="kpi-value text-terminal-accent">{s.temperature}°</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-terminal-dim">赚钱效应</div>
          <div className="kpi-value text-red-400">{s.profit_effect}%</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-terminal-dim">炸板率</div>
          <div className="kpi-value text-orange-400">{s.break_rate}%</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs text-terminal-dim">最高连板</div>
          <div className="kpi-value text-yellow-400">{s.max_boards}板</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">情绪与赚钱效应趋势</h2></div>
          <div className="panel-body"><ReactECharts option={tempOption} style={{ height: 280 }} /></div>
        </div>
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">涨停/跌停数量趋势</h2></div>
          <div className="panel-body"><ReactECharts option={barOption} style={{ height: 280 }} /></div>
        </div>
      </div>
    </div>
  );
}
