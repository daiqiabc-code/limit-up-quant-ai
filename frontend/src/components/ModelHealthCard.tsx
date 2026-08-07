/**
 * 模型健康监控卡片
 * 展示策略池表格 + 世界模型网格 + 健康分
 */

import { useEffect, useState } from 'react';
import { Activity, Globe, Gauge } from 'lucide-react';
import { api, type HealthPoolSnapshot, type HealthWorldSnapshot, type HealthModelSnapshot } from '../lib/api';

export default function ModelHealthCard() {
  const [pool, setPool] = useState<HealthPoolSnapshot | null>(null);
  const [world, setWorld] = useState<HealthWorldSnapshot | null>(null);
  const [model, setModel] = useState<HealthModelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      api.healthPool(),
      api.healthWorld(),
      api.healthModel(),
    ]).then(([p, w, m]) => {
      if (p.status === 'fulfilled') setPool(p.value);
      if (w.status === 'fulfilled') setWorld(w.value);
      if (m.status === 'fulfilled') setModel(m.value);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="text-terminal-dim text-sm p-4">加载模型健康数据...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 健康分总览 */}
      {model && (
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Gauge size={16} className="text-terminal-accent" />
              <span className="text-sm font-medium">模型健康分</span>
            </div>
            <span className={`text-lg font-bold ${model.health_score >= 70 ? 'text-red-400' : model.health_score >= 50 ? 'text-amber-400' : 'text-green-400'}`}>
              {model.health_score}
            </span>
          </div>
          <div className="panel-body grid grid-cols-2 gap-2 text-xs">
            <div>状态：<span className="text-terminal-accent">{model.health_status}</span></div>
            <div>版本：{model.model_version}</div>
            <div>总预测数：{model.total_predictions}</div>
            <div>已验证：{model.total_verifications}</div>
            <div>训练样本：{model.training_samples}</div>
            <div>进化次数：{model.evolve_cycles}</div>
            {model.avg_brier !== null && (
              <div>Brier 分数：{model.avg_brier.toFixed(4)}</div>
            )}
            {model.recent_accuracy_3avg !== null && (
              <div>近 3 次准确率：{(model.recent_accuracy_3avg * 100).toFixed(1)}%</div>
            )}
          </div>
        </div>
      )}

      {/* 策略池表格 */}
      {pool && (
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-terminal-accent" />
              <span className="text-sm font-medium">策略池 · 第 {pool.generation} 代 · 共进化 {pool.total_evolves} 次</span>
            </div>
            <span className="text-xs text-terminal-dim">主策略：{pool.active_style}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>风格</th>
                  <th className="text-right">适应度</th>
                  <th className="text-right" title="is_up_next 次日上涨准确率">上涨率</th>
                  <th className="text-right" title="is_limit_up_next 次日继续涨停准确率">涨停率</th>
                  <th className="text-right" title="is_open_up 次日红盘开盘准确率">开盘率</th>
                  <th className="text-right" title="预测概率 vs next_pct 秩相关">秩相关</th>
                  <th className="text-right">Brier</th>
                  <th className="text-right">样本</th>
                  <th>权重向量</th>
                </tr>
              </thead>
              <tbody>
                {pool.pool.map((s) => (
                  <tr key={s.version} className={s.version === pool.active_id ? 'bg-terminal-accent/5' : ''}>
                    <td className="whitespace-nowrap">
                      {s.style}
                      {s.version === pool.active_id && (
                        <span className="ml-1 text-[10px] text-terminal-accent">★ 主策略</span>
                      )}
                    </td>
                    <td className="text-right font-mono text-terminal-accent">{s.fitness.toFixed(3)}</td>
                    <td className="text-right font-mono">{(s.accuracy * 100).toFixed(1)}%</td>
                    <td className="text-right font-mono">
                      {s.acc_limit != null ? `${(s.acc_limit * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="text-right font-mono">
                      {s.acc_open != null ? `${(s.acc_open * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="text-right font-mono">
                      {s.rank_corr != null ? s.rank_corr.toFixed(2) : '—'}
                    </td>
                    <td className="text-right font-mono">{s.brier.toFixed(3)}</td>
                    <td className="text-right font-mono">{s.samples_tested}</td>
                    <td className="text-xs text-terminal-dim">
                      {Object.entries(s.weights).map(([k, v]) => `${k.slice(0, 3)}:${(v * 100).toFixed(0)}`).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 主策略基因参数（进化变异的可调阈值） */}
          {pool.active_gene && (
            <div className="panel-body border-t border-terminal-border/50">
              <div className="text-xs text-terminal-dim mb-1">主策略基因（打分阈值，进化时变异）</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-terminal-text">
                {Object.entries(pool.active_gene).map(([k, v]) => (
                  <span key={k}>
                    <span className="text-terminal-dim">{k}</span>
                    <span className="text-terminal-accent ml-1">{typeof v === 'number' ? v.toFixed(3) : v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 世界模型网格 */}
      {world && (
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-terminal-accent" />
              <span className="text-sm font-medium">世界模型 · 市场环境</span>
            </div>
            <span className="text-xs text-terminal-accent">{world.environment}</span>
          </div>
          <div className="panel-body space-y-3">
            <p className="text-xs text-terminal-dim">{world.env_description}</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-terminal-card rounded p-2 text-center">
                <div className="text-terminal-dim">涨停数</div>
                <div className="font-mono text-red-400">{world.signals.zt_count}</div>
              </div>
              <div className="bg-terminal-card rounded p-2 text-center">
                <div className="text-terminal-dim">最高板</div>
                <div className="font-mono text-amber-400">{world.signals.max_boards}板</div>
              </div>
              <div className="bg-terminal-card rounded p-2 text-center">
                <div className="text-terminal-dim">连板占比</div>
                <div className="font-mono text-terminal-accent">{(world.signals.board_ratio * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-terminal-card rounded p-2 text-center">
                <div className="text-terminal-dim">跌停数</div>
                <div className="font-mono text-green-400">{world.signals.limit_down_count}</div>
              </div>
            </div>
            <div className="text-xs text-terminal-dim">
              置信系数：<span className="text-terminal-accent">{world.confidence_factor.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
