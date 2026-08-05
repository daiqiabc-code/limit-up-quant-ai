import { useEffect, useState } from 'react';
import { TrendingUp, Zap, Target, BarChart3, AlertTriangle, DollarSign, ArrowUpRight } from 'lucide-react';
import { api, PotentialStock, PotentialScanResult } from '../lib/api';

const gradeClass = (g: string) =>
  g === 'S' ? 'grade-s' : g === 'A' ? 'grade-a' : g === 'B' ? 'grade-b' : g === 'C' ? 'grade-c' : 'grade-d';

const rankColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600', 'text-terminal-dim', 'text-terminal-dim'];

export default function PotentialLimitUp() {
  const [data, setData] = useState<PotentialScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.potential(undefined, 10)
      .then(setData)
      .catch((e) => setError(e?.message ?? '请求失败'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <div className="animate-pulse mb-3">
            <Target size={36} className="mx-auto text-terminal-accent/50" />
          </div>
          <p className="text-sm">正在扫描今日市场强势股...</p>
          <p className="text-xs text-terminal-dim/60 mt-1">实时数据加载中</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-terminal-dim">
          <AlertTriangle size={32} className="mx-auto mb-2 text-amber-400" />
          <p className="text-sm">数据加载失败</p>
          <p className="text-xs text-terminal-dim/60 mt-1">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(''); api.potential(undefined, 10).then(setData).catch(e => setError(e?.message ?? '请求失败')).finally(() => setLoading(false)); }}
            className="mt-3 px-3 py-1 text-xs bg-terminal-accent/20 text-terminal-accent rounded hover:bg-terminal-accent/30"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (!data || !data.ranking.length) {
    return (
      <div className="flex items-center justify-center h-64 text-terminal-dim">
        <div className="text-center">
          <Target size={32} className="mx-auto mb-2 text-terminal-dim/50" />
          <p>今日暂无强势股数据</p>
          <p className="text-xs text-terminal-dim/60 mt-1">
            交易日 {data?.trade_date || '—'} · 市场可能尚未开盘或数据延迟
          </p>
        </div>
      </div>
    );
  }

  const ranks = data.ranking;
  const top = ranks[0];
  const aCount = ranks.filter(r => r.grade === 'A').length;
  const bCount = ranks.filter(r => r.grade === 'B').length;

  return (
    <div className="p-6 space-y-5">
      {/* ---- 页头 ---- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Zap size={22} className="text-yellow-400" />
            今日涨停潜力榜
          </h1>
          <p className="text-sm text-terminal-dim">
            {data.trade_date} · 扫描 {data.total_candidates} 只强势股 · Top {ranks.length} 排名
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-0.5 rounded bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
            A 级 {aCount}
          </span>
          <span className="px-2 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/30">
            B 级 {bCount}
          </span>
          <span className="px-2 py-0.5 rounded bg-terminal-accent/10 text-terminal-accent border border-terminal-accent/30">
            实时扫描
          </span>
        </div>
      </div>

      {/* ---- #1 最看好 高亮卡片 ---- */}
      {top && (
        <div className="bg-gradient-to-br from-yellow-400/8 via-yellow-400/3 to-transparent border border-yellow-400/25 rounded-xl p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="shrink-0">
              <div className="text-[10px] text-yellow-400/80 mb-1">{top.rank_label}</div>
              <div className={`text-4xl font-bold ${rankColors[0]}`}>#{top.rank}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-bold text-terminal-text">{top.name}</span>
                <span className="text-sm text-terminal-dim">{top.code}</span>
                {top.is_new_high && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-purple-400/15 text-purple-400 rounded border border-purple-400/30">
                    60日新高
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-terminal-dim mb-2">
                <span className="flex items-center gap-1">
                  <TrendingUp size={14} className="text-red-400" />
                  <span className="text-red-400 font-medium">+{top.change_pct}%</span>
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 size={14} />
                  量比 {top.vol_ratio}x
                </span>
                <span className="flex items-center gap-1">
                  <Zap size={14} className="text-yellow-400" />
                  连板 {top.zt_stat}
                </span>
                <span>换手 {top.turnover}%</span>
                <span className="text-terminal-dim/70">{top.industry}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {top.reasons.map((r, i) => (
                  <span key={i} className="text-[11px] px-2 py-0.5 bg-terminal-card rounded text-terminal-dim">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className={`text-3xl font-bold ${top.grade === 'A' ? 'text-emerald-400' : top.grade === 'B' ? 'text-blue-400' : 'text-terminal-dim'}`}>
                {top.total_score}
              </div>
              <div className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${gradeClass(top.grade)}`}>
                {top.grade} 级
              </div>
              <div className="text-[10px] text-terminal-dim mt-1">综合评分</div>
            </div>
          </div>

          {/* 分项得分条 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: '接近度', value: top.proximity_score, max: 35 },
              { label: '量能', value: top.volume_score, max: 25 },
              { label: '连板势', value: top.streak_score, max: 20 },
              { label: '新高', value: top.new_high_score, max: 10 },
              { label: '换手', value: top.turnover_score, max: 10 },
            ].map(d => (
              <div key={d.label} className="text-center">
                <div className="text-[10px] text-terminal-dim mb-1">{d.label}</div>
                <div className="h-1.5 bg-terminal-card rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full bg-yellow-400/60 rounded-full transition-all"
                    style={{ width: `${Math.min((d.value / d.max) * 100, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-terminal-text font-mono">{d.value}/{d.max}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- #2-#3 次级关注 ---- */}
      {ranks.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ranks.slice(1, 3).map((r) => (
            <div key={r.code} className="bg-terminal-panel border border-terminal-border rounded-lg p-4 hover:border-terminal-accent/30 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${rankColors[r.rank - 1]}`}>#{r.rank}</span>
                  <span className="font-bold text-terminal-text">{r.name}</span>
                  <span className="text-xs text-terminal-dim">{r.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${r.grade === 'A' ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {r.total_score}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeClass(r.grade)}`}>{r.grade}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-terminal-dim mb-2">
                <span className="text-red-400 font-medium">+{r.change_pct}%</span>
                <span>量比 {r.vol_ratio}x</span>
                <span>连板 {r.zt_stat}</span>
                <span>换手 {r.turnover}%</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {r.reasons.map((rs, i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 bg-terminal-card rounded text-terminal-dim/80">
                    {rs}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- #4-#10 完整排表 ---- */}
      <div className="bg-terminal-panel border border-terminal-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-terminal-card/50 text-terminal-dim text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 w-12">#</th>
                <th className="text-left px-4 py-2.5">股票</th>
                <th className="text-right px-4 py-2.5">涨幅</th>
                <th className="text-right px-4 py-2.5">量比</th>
                <th className="text-right px-4 py-2.5">连板</th>
                <th className="text-right px-4 py-2.5">换手%</th>
                <th className="text-right px-4 py-2.5">5日趋势</th>
                <th className="text-center px-4 py-2.5 w-14">评分</th>
                <th className="text-center px-4 py-2.5 w-14">排名评级</th>
                <th className="text-left px-4 py-2.5">核心理由</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {ranks.map((r) => (
                <tr
                  key={r.code}
                  className={`hover:bg-terminal-card/40 transition-colors ${
                    r.rank === 1 ? 'bg-yellow-400/[0.02]' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className={`font-bold ${rankColors[Math.min(r.rank - 1, 4)]}`}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-terminal-text">{r.name}</span>
                      <span className="text-xs text-terminal-dim">{r.code}</span>
                      {r.is_new_high && (
                        <span className="text-[9px] px-1 py-0.5 bg-purple-400/10 text-purple-400/80 rounded">
                          新高
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-terminal-dim/70 mt-0.5">{r.industry}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-red-400 font-medium">+{r.change_pct}%</span>
                  </td>
                  <td className="px-4 py-3 text-right text-terminal-text font-mono text-xs">
                    {r.vol_ratio}x
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-mono text-xs ${
                      r.zt_stat !== '0/0' ? 'text-yellow-400' : 'text-terminal-dim'
                    }`}>
                      {r.zt_stat}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-terminal-text font-mono text-xs">
                    {r.turnover}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <span className={r.trend_5d >= 0 ? 'text-red-400' : 'text-emerald-400'}>
                      {r.trend_5d >= 0 ? '+' : ''}{r.trend_5d}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-base ${
                      r.grade === 'A' ? 'text-emerald-400' :
                      r.grade === 'B' ? 'text-blue-400' :
                      'text-terminal-text'
                    }`}>
                      {r.total_score}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-center ${gradeClass(r.rel_grade || r.grade)}`}>
                      {r.rel_grade || r.grade}
                    </span>
                    {r.percentile != null && (
                      <span className="text-[9px] text-terminal-dim block mt-0.5">P{r.percentile}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.reasons.slice(0, 3).map((rs, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 bg-terminal-card rounded text-terminal-dim/80">
                          {rs}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- 页脚说明 ---- */}
      <div className="text-[11px] text-terminal-dim/60 flex items-center gap-1.5">
        <AlertTriangle size={12} />
        <span>以上榜单基于实时市场数据自动生成，仅供参考，不构成投资建议。</span>
        <span className="mx-1">·</span>
        <span>实时扫描于 {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}
