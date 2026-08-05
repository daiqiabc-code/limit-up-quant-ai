import { useEffect, useState } from 'react';
import { api, StockDetail } from '../lib/api';
import { ArrowUp, ArrowDown } from 'lucide-react';
import ReactECharts from 'echarts-for-react';

export default function StockDetailPage({ code }: { code: string }) {
  const [data, setData] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    api.detail(code).then(setData).finally(() => setLoading(false));
  }, [code]);

  if (!code) return <div className="p-6 text-terminal-dim">请从涨停列表或AI排行榜点击选择股票</div>;
  if (loading) return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;
  if (!data) return null;

  const s = data.stock;
  const r = data.limit_up_record;
  const p = data.prediction;

  // K线 option
  const dates = data.quotes.map(q => q.trade_date.slice(5));
  const ohlc = data.quotes.map(q => [q.open, q.close, q.low, q.high]);
  const vols = data.quotes.map(q => q.volume);

  const chartOption = {
    backgroundColor: '#0a0a12',
    grid: [{ left: '8%', right: '3%', top: '8%', height: '55%' }, { left: '8%', right: '3%', top: '72%', height: '18%' }],
    xAxis: [{ type: 'category', data: dates, axisLine: { lineStyle: { color: '#1e1e3a' } }, axisLabel: { color: '#6b6b80', fontSize: 10 } },
      { type: 'category', gridIndex: 1, data: dates, axisLabel: { show: false }, axisLine: { lineStyle: { color: '#1e1e3a' } } }],
    yAxis: [{ type: 'value', scale: true, axisLine: { lineStyle: { color: '#1e1e3a' } }, axisLabel: { color: '#6b6b80', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e1e3a', type: 'dashed' } } },
      { type: 'value', gridIndex: 1, axisLabel: { color: '#6b6b80', fontSize: 9 } }],
    series: [
      { type: 'candlestick', data: ohlc, itemStyle: { color: '#ff5252', color0: '#00e676', borderColor: '#ff5252', borderColor0: '#00e676' } },
      { type: 'bar', xAxisIndex: 1, yAxisIndex: 1, data: vols, itemStyle: { color: (params: any) => data.quotes[params.dataIndex]?.close >= data.quotes[params.dataIndex]?.open ? '#ff525244' : '#00e67644' } },
    ],
    tooltip: { trigger: 'axis' },
  };

  return (
    <div className="p-6 space-y-6">
      {/* 头部信息 */}
      {s && (
        <div className="panel p-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{s.name} <span className="text-sm text-terminal-dim font-mono">{s.code}</span></h1>
            <div className="flex gap-3 mt-1 text-xs text-terminal-dim">
              <span>{s.exchange} · {s.board}</span><span>{s.industry}</span>
              <span>{s.concepts?.join(' / ')}</span>
            </div>
            {r && (
              <div className="flex gap-4 mt-2">
                <span className="badge-up">+{r.pct_chg}%</span>
                <span className="text-sm"><span className="text-terminal-dim">连板</span> <b>{r.boards}板</b></span>
                <span className="text-sm"><span className="text-terminal-dim">封板</span> {r.seal_time}</span>
                <span className="text-sm"><span className="text-terminal-dim">换手</span> {r.turnover.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="text-right space-y-2">
            <div className="text-sm text-terminal-dim">流通市值 <span className="text-terminal-text">{s.float_mv}亿</span></div>
            <div className="text-sm text-terminal-dim">总市值 <span className="text-terminal-text">{s.total_mv}亿</span></div>
            {r && <div className="text-sm text-terminal-dim">主力净流入 <span className={r.main_net_inflow >= 0 ? 'text-red-400' : 'text-green-400'}>{(r.main_net_inflow / 1e8).toFixed(2)}亿</span></div>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        {/* K线图 */}
        <div className="col-span-2 panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">K线图</h2></div>
          <div className="panel-body">
            <ReactECharts option={chartOption} style={{ height: 400 }} />
          </div>
        </div>

        {/* AI 分析报告 */}
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">AI 分析报告</h2></div>
          <div className="panel-body space-y-3 text-sm">
            {p ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{p.name}({p.code})</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${p.grade === 'S' ? 'grade-s' : p.grade === 'A' ? 'grade-a' : 'grade-b'}`}>{p.grade}级</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-terminal-dim">涨停概率</span> <span className="font-bold text-terminal-accent">{(p.prob_limit_up * 100).toFixed(1)}%</span></div>
                  <div><span className="text-terminal-dim">上涨概率</span> <span className="font-bold">{(p.prob_up * 100).toFixed(1)}%</span></div>
                  <div><span className="text-terminal-dim">预期收益</span> <span className="text-red-400">+{p.expected_return}%</span></div>
                  <div><span className="text-terminal-dim">预期回撤</span> <span className="text-green-400">-{p.expected_drawdown}%</span></div>
                </div>
                <div className="border-t border-terminal-border pt-2">
                  <div className="text-xs text-terminal-dim mb-1">建议：<span className="text-terminal-accent font-bold">{p.advice}</span></div>
                  <div className="text-xs text-terminal-dim mb-1">风险等级：<span className={p.risk_level === '低' ? 'text-green-400' : 'text-yellow-400'}>{p.risk_level}</span></div>
                </div>
                {p.sub_scores && (
                  <div className="space-y-1">
                    <div className="text-xs text-terminal-dim font-medium">各维度评分</div>
                    {Object.entries(p.sub_scores as Record<string, number>).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className="text-xs w-20">{k}</span>
                        <div className="flex-1 h-1.5 bg-terminal-border rounded-full">
                          <div className="h-full bg-terminal-accent rounded-full" style={{ width: `${v / 20 * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono w-8">{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {p.reasons && (
                  <div className="border-t border-terminal-border pt-2 space-y-1">
                    <div className="text-xs text-terminal-dim font-medium">核心论据</div>
                    {(p.reasons as string[]).map((rs, i) => (
                      <div key={i} className="text-xs flex items-start gap-1"><span className="text-terminal-accent">•</span> {rs}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-terminal-dim">暂无AI分析数据</div>
            )}
          </div>
        </div>
      </div>

      {/* 龙虎榜 & 新闻 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">龙虎榜</h2></div>
          <div className="panel-body">
            {data.dragon_tiger && data.dragon_tiger.length > 0 ? (
              <table className="data-table w-full">
                <thead><tr><th>席位</th><th>类型</th><th>标签</th><th>买入</th><th>卖出</th><th>净额</th></tr></thead>
                <tbody>
                  {data.dragon_tiger.map((d, i) => (
                    <tr key={i}>
                      <td className="text-xs">{d.seat}</td>
                      <td className="text-xs">{d.seat_type}</td>
                      <td className="text-xs">{d.tag || '—'}</td>
                      <td className="text-xs text-red-400">{(d.buy / 1e8).toFixed(2)}亿</td>
                      <td className="text-xs text-green-400">{(d.sell / 1e8).toFixed(2)}亿</td>
                      <td className={d.net >= 0 ? 'text-red-400 text-xs' : 'text-green-400 text-xs'}>{(d.net / 1e8).toFixed(2)}亿</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="text-sm text-terminal-dim">当日未上龙虎榜</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">相关新闻</h2></div>
          <div className="panel-body">
            {data.news && data.news.length > 0 ? (
              <div className="space-y-2">
                {data.news.map((n, i) => (
                  <div key={i} className="text-sm p-2 bg-terminal-card/50 rounded">
                    <div className="text-terminal-text">{n.title}</div>
                    <div className="flex gap-3 mt-1 text-xs text-terminal-dim">
                      <span>{n.source}</span>
                      <span className={n.sentiment > 0.5 ? 'text-red-400' : n.sentiment < -0.3 ? 'text-green-400' : 'text-terminal-dim'}>
                        情绪 {n.sentiment > 0 ? '正面' : '负面'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-terminal-dim">暂无相关新闻</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
