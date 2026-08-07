import { useEffect, useState } from 'react';
import {
  api,
  type RankingSnapshot,
  type LimitUpSnapshot,
  type HealthPoolSnapshot,
  type ScoredRecord,
  type LimitUpRecord,
  type StrategyEntry,
} from '../lib/api';
import { DualGradeBadge } from '../components/GradeBadge';
import ScoreBar from '../components/ScoreBar';

/** 维度中文映射（与 ScoreBar 一致） */
const DIM_CN: Record<string, string> = {
  board_strength: '连板强度',
  seal_quality: '封单质量',
  sector_position: '板块地位',
  theme_freshness: '题材新鲜度',
  volume_health: '量价健康',
};

/** 根据命中的 active_strategy 在策略池中查找对应条目 */
function findStrategy(
  pool: HealthPoolSnapshot | null,
  activeStrategy: string | undefined,
): StrategyEntry | undefined {
  if (!pool) return undefined;
  if (activeStrategy) {
    return (
      pool.pool.find(p => p.style === activeStrategy) ||
      pool.pool.find(p => p.version === activeStrategy)
    );
  }
  return (
    pool.pool.find(p => p.version === pool.active_id) ||
    pool.pool.find(p => p.style === pool.active_style)
  );
}

export default function StockDetail({ code }: { code: string }) {
  const [ranking, setRanking] = useState<RankingSnapshot | null>(null);
  const [limitup, setLimitup] = useState<LimitUpSnapshot | null>(null);
  const [healthPool, setHealthPool] = useState<HealthPoolSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError(null);
    Promise.all([api.ranking(), api.limitup(), api.healthPool()])
      .then(([r, l, h]) => {
        setRanking(r);
        setLimitup(l);
        setHealthPool(h);
      })
      .catch(e => setError(e?.message || '数据加载失败'))
      .finally(() => setLoading(false));
  }, [code]);

  if (!code) {
    return <div className="p-6 text-terminal-dim">请从涨停列表或 AI 排行榜点击选择股票</div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-64 text-terminal-dim">加载中...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-400">数据加载失败：{error}</div>;
  }

  const record: ScoredRecord | undefined = ranking?.ranking.find(r => r.code === code);
  const limitRecord: LimitUpRecord | undefined = limitup?.records.find(r => r.code === code);
  const strategy = findStrategy(healthPool, ranking?.active_strategy);

  // ranking 中未找到该股票
  if (!record) {
    return (
      <div className="p-6 space-y-4">
        <div className="panel p-8 text-center">
          <div className="text-terminal-dim text-lg">未找到该股票的AI评分数据</div>
          <div className="text-xs text-terminal-dim/70 mt-2 font-mono">{code}</div>
        </div>
        {limitRecord && (
          <div className="panel">
            <div className="panel-header"><h2 className="text-sm font-semibold">涨停基础信息</h2></div>
            <div className="panel-body grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><div className="text-xs text-terminal-dim">名称</div><div className="font-medium">{limitRecord.name}</div></div>
              <div><div className="text-xs text-terminal-dim">涨停价</div><div className="font-mono text-red-400">{limitRecord.limit_price.toFixed(2)}</div></div>
              <div><div className="text-xs text-terminal-dim">封单额</div><div className="font-mono text-red-400">{(limitRecord.fd_amount / 1e4).toFixed(2)}亿</div></div>
              <div><div className="text-xs text-terminal-dim">连板</div><div className="font-mono text-red-400">{limitRecord.fb_count}板</div></div>
              <div><div className="text-xs text-terminal-dim">所属行业</div><div>{limitRecord.industry || '—'}</div></div>
              {limitRecord.reason && (
                <div className="col-span-2 md:col-span-4"><div className="text-xs text-terminal-dim">涨停原因</div><div className="text-sm">{limitRecord.reason}</div></div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  const exp = record.explain;
  const price = record.price ?? limitRecord?.price;
  const boards = record.boards ?? limitRecord?.fb_count ?? 0;
  const industry = record.industry || limitRecord?.industry || '—';
  const name = record.name || limitRecord?.name || code;
  const maxContrib = Math.max(
    1,
    ...exp.top_positive.map(i => Math.abs(i.contribution)),
    ...exp.top_negative.map(i => Math.abs(i.contribution)),
  );

  return (
    <div className="p-6 space-y-6">
      {/* 头部信息 */}
      <div className="panel">
        <div className="panel-body flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{name}</h1>
              <span className="text-sm text-terminal-dim font-mono">{record.code}</span>
              <span className="text-xs text-terminal-dim">#{record.rank}</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-terminal-dim">
              <span>最新价 <span className="text-terminal-text font-mono">{price != null ? price.toFixed(2) : '—'}</span></span>
              <span>连板 <span className="text-red-400 font-bold">{boards}板</span></span>
              <span>行业 <span className="text-terminal-text">{industry}</span></span>
              {record.concepts && record.concepts.length > 0 && (
                <span>题材 <span className="text-terminal-text">{record.concepts.join(' / ')}</span></span>
              )}
            </div>
            {limitRecord?.reason && (
              <div className="mt-2 text-xs"><span className="text-terminal-dim">涨停原因：</span>{limitRecord.reason}</div>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
            <DualGradeBadge absGrade={record.abs_grade} relGrade={record.rel_grade} percentile={record.percentile} />
            <div className="text-left md:text-right">
              <div className="text-xs text-terminal-dim">综合得分</div>
              <div className="text-4xl font-bold font-mono text-terminal-accent leading-none">{record.total_score.toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 五维分项得分 */}
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">五维分项得分</h2></div>
          <div className="panel-body">
            <ScoreBar scores={record.sub_scores} />
            <div className="mt-4 pt-3 border-t border-terminal-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-terminal-dim">
              {record.seal_time && <span>封板时间 <span className="text-terminal-text font-mono">{record.seal_time}</span></span>}
              {record.break_times != null && <span>炸板次数 <span className="text-terminal-text font-mono">{record.break_times}</span></span>}
              {record.limit_type && <span>涨停类型 <span className="text-terminal-text">{record.limit_type}</span></span>}
              {record.turnover != null && <span>换手率 <span className="text-terminal-text font-mono">{record.turnover.toFixed(2)}%</span></span>}
            </div>
          </div>
        </div>

        {/* 涨停基础信息 */}
        <div className="panel">
          <div className="panel-header"><h2 className="text-sm font-semibold">涨停基础信息</h2></div>
          <div className="panel-body grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-terminal-dim">涨停价</div>
              <div className="font-mono text-red-400">{limitRecord ? limitRecord.limit_price.toFixed(2) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-terminal-dim">封单额</div>
              <div className="font-mono text-red-400">{limitRecord ? `${(limitRecord.fd_amount / 1e4).toFixed(2)}亿` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-terminal-dim">连板数</div>
              <div className="font-mono text-red-400">{boards}板</div>
            </div>
            {record.float_mv != null && (
              <div>
                <div className="text-xs text-terminal-dim">流通市值</div>
                <div className="font-mono">{record.float_mv.toFixed(2)}亿</div>
              </div>
            )}
            {record.amount != null && (
              <div>
                <div className="text-xs text-terminal-dim">成交额</div>
                <div className="font-mono">{(record.amount / 1e8).toFixed(2)}亿</div>
              </div>
            )}
            <div>
              <div className="text-xs text-terminal-dim">所属行业</div>
              <div>{industry}</div>
            </div>
            {limitRecord?.reason && (
              <div className="col-span-2 md:col-span-3">
                <div className="text-xs text-terminal-dim">涨停原因</div>
                <div className="text-sm">{limitRecord.reason}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 因果解释 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">因果解释</h2></div>
        <div className="panel-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 正向贡献 */}
            <div>
              <div className="text-xs text-green-400 mb-2 font-medium">↑ 主要正向贡献</div>
              <div className="space-y-2">
                {exp.top_positive.length > 0 ? exp.top_positive.map((it, i) => (
                  <div key={`p-${i}`} className="flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">↑</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-400 font-medium">{it.dimension_cn || DIM_CN[it.dimension] || it.dimension}</span>
                        <span className="text-xs font-mono text-green-400/80">+{it.contribution.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-terminal-card rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{ width: `${(Math.abs(it.contribution) / maxContrib) * 100}%` }} />
                      </div>
                      {it.desc && <div className="text-xs text-terminal-dim mt-1">{it.desc}</div>}
                    </div>
                  </div>
                )) : <div className="text-xs text-terminal-dim">无显著正向贡献</div>}
              </div>
            </div>
            {/* 负向贡献 */}
            <div>
              <div className="text-xs text-red-400 mb-2 font-medium">↓ 主要负向贡献</div>
              <div className="space-y-2">
                {exp.top_negative.length > 0 ? exp.top_negative.map((it, i) => (
                  <div key={`n-${i}`} className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5">↓</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-red-400 font-medium">{it.dimension_cn || DIM_CN[it.dimension] || it.dimension}</span>
                        <span className="text-xs font-mono text-red-400/80">{it.contribution.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 h-1 bg-terminal-card rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(Math.abs(it.contribution) / maxContrib) * 100}%` }} />
                      </div>
                      {it.desc && <div className="text-xs text-terminal-dim mt-1">{it.desc}</div>}
                    </div>
                  </div>
                )) : <div className="text-xs text-terminal-dim">无显著负向贡献</div>}
              </div>
            </div>
          </div>
          {exp.summary && (
            <div className="border-t border-terminal-border pt-3 text-sm">
              <span className="text-xs text-terminal-dim mr-2">总结</span>
              <span className="text-terminal-text">{exp.summary}</span>
            </div>
          )}
        </div>
      </div>

      {/* 策略池命中 */}
      <div className="panel">
        <div className="panel-header"><h2 className="text-sm font-semibold">策略池命中</h2></div>
        <div className="panel-body space-y-4">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <div>
              <div className="text-xs text-terminal-dim">命中策略</div>
              <div className="text-terminal-accent font-medium">{ranking?.active_strategy || healthPool?.active_style || '—'}</div>
            </div>
            {strategy && (
              <>
                <div>
                  <div className="text-xs text-terminal-dim">版本</div>
                  <div className="font-mono">{strategy.version}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">风格描述</div>
                  <div className="max-w-xs">{strategy.style_desc || strategy.style}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">适应度</div>
                  <div className="font-mono text-green-400">{strategy.fitness.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">准确率</div>
                  <div className="font-mono text-terminal-accent">{(strategy.accuracy * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">Brier</div>
                  <div className="font-mono">{strategy.brier.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">代际</div>
                  <div className="font-mono">G{strategy.generation}</div>
                </div>
                <div>
                  <div className="text-xs text-terminal-dim">样本数</div>
                  <div className="font-mono">{strategy.samples_tested}</div>
                </div>
                {strategy.acc_limit != null && (
                  <div title="is_limit_up_next 次日继续涨停准确率">
                    <div className="text-xs text-terminal-dim">涨停准确率</div>
                    <div className="font-mono text-amber-400">{(strategy.acc_limit * 100).toFixed(1)}%</div>
                  </div>
                )}
                {strategy.acc_open != null && (
                  <div title="is_open_up 次日红盘开盘准确率">
                    <div className="text-xs text-terminal-dim">开盘准确率</div>
                    <div className="font-mono text-amber-400">{(strategy.acc_open * 100).toFixed(1)}%</div>
                  </div>
                )}
                {strategy.rank_corr != null && (
                  <div title="预测概率 vs next_pct 秩相关">
                    <div className="text-xs text-terminal-dim">秩相关</div>
                    <div className="font-mono">{strategy.rank_corr.toFixed(2)}</div>
                  </div>
                )}
              </>
            )}
          </div>
          {strategy?.weights && (
            <div className="border-t border-terminal-border pt-3">
              <div className="text-xs text-terminal-dim mb-2">权重配置</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {Object.entries(strategy.weights).map(([k, v]) => (
                  <div key={k} className="bg-terminal-card/50 rounded px-2 py-1.5">
                    <div className="text-xs text-terminal-dim">{DIM_CN[k] || k}</div>
                    <div className="font-mono text-sm text-terminal-text">{v.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {strategy?.gene_params && (
            <div className="border-t border-terminal-border pt-3">
              <div className="text-xs text-terminal-dim mb-2">基因参数（打分阈值，进化时变异）</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono">
                {Object.entries(strategy.gene_params).map(([k, v]) => (
                  <span key={k}>
                    <span className="text-terminal-dim">{k}</span>
                    <span className="text-terminal-accent ml-1">{typeof v === 'number' ? v.toFixed(3) : v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
