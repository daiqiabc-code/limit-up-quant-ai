import { useEffect, useState } from 'react';
import { Activity, Brain, TrendingUp, AlertTriangle, Zap, Clock, Database } from 'lucide-react';
import { api, ModelHealth, EvolutionHealth } from '../lib/api';

function healthColor(v: number) {
  if (v >= 80) return 'text-emerald-400';
  if (v >= 60) return 'text-blue-400';
  if (v >= 40) return 'text-yellow-400';
  return 'text-red-400';
}

function stageColor(stage: string) {
  const m: Record<string, string> = { embryonic: 'text-terminal-dim', juvenile: 'text-blue-400', mature: 'text-yellow-400', expert: 'text-emerald-400' };
  return m[stage] || 'text-terminal-dim';
}

export default function ModelHealthCard() {
  const [model, setModel] = useState<ModelHealth | null>(null);
  const [evo, setEvo] = useState<EvolutionHealth | null>(null);

  useEffect(() => {
    api.modelHealth().then(setModel).catch(() => {});
    api.evolutionHealth().then(setEvo).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {/* ---- 模型健康评分 ---- */}
      {model && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Brain size={16} className="text-terminal-accent" />
            AI 模型健康
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${healthColor(model.health_score)}`}>
                {model.health_score}
              </div>
              <div className="text-[10px] text-terminal-dim mt-1">健康评分</div>
              <div className="text-xs text-terminal-dim">{model.health_status}</div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-terminal-text">{model.model_version}</div>
              <div className="text-[10px] text-terminal-dim mt-1">模型版本</div>
              <div className="text-[10px] text-terminal-dim/70">{model.model_trained_at?.slice(0,16) || '—'}</div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-blue-400">{model.training_samples}</div>
              <div className="text-[10px] text-terminal-dim mt-1">训练样本</div>
              <div className="text-[10px] text-terminal-dim/70">
                {model.pending_samples > 0 ? `+${model.pending_samples} 待处理` : '已同步'}
              </div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-emerald-400">
                {model.recent_accuracy_3avg != null ? `${(model.recent_accuracy_3avg * 100).toFixed(0)}%` : '—'}
              </div>
              <div className="text-[10px] text-terminal-dim mt-1">近3轮准确率</div>
              <div className="text-[10px] text-terminal-dim/70">
                Brier {model.avg_brier != null ? model.avg_brier.toFixed(3) : '—'}
              </div>
            </div>
          </div>
          {/* 置信度区间提示 */}
          <div className="flex items-center gap-2 text-[11px] text-terminal-dim/80">
            <Activity size={12} />
            <span>预测不确定度 ±{model.prediction_uncertainty.toFixed(3)}</span>
            <span className="mx-1">·</span>
            <span>验证 {model.total_verifications} 次 · {model.total_predictions} 条预测</span>
            {model.active_anomalies > 0 && (
              <span className="ml-auto flex items-center gap-1 text-amber-400">
                <AlertTriangle size={11} />
                {model.active_anomalies} 异常
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---- 进化状态 ---- */}
      {evo && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Zap size={16} className="text-yellow-400" />
            进化引擎状态
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${stageColor(evo.evolution_stage)}`}>
                {evo.evolve_cycles}
              </div>
              <div className="text-[10px] text-terminal-dim mt-1">进化周期</div>
              <div className="text-[10px] text-terminal-dim/70">{evo.evolution_stage_label.slice(0,8)}...</div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-terminal-text">{evo.learnings_count}</div>
              <div className="text-[10px] text-terminal-dim mt-1">经验记录</div>
              <div className="text-[10px] text-terminal-dim/70">{evo.learnings_pending} 待处理</div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-red-400">{evo.errors_count}</div>
              <div className="text-[10px] text-terminal-dim mt-1">错误记录</div>
            </div>
            <div className="bg-terminal-card rounded-lg p-3 text-center">
              <div className={`text-lg font-bold ${evo.retrain_recommended ? 'text-amber-400' : 'text-terminal-dim'}`}>
                {evo.retrain_recommended ? '建议' : '暂不需要'}
              </div>
              <div className="text-[10px] text-terminal-dim mt-1">重训建议</div>
              <div className="text-[10px] text-terminal-dim/70">
                {evo.next_stage_in != null ? `${evo.next_stage_in} 次后进阶` : '最高阶段'}
              </div>
            </div>
          </div>
          {/* 进化信息 */}
          <div className="flex items-center gap-2 text-[11px] text-terminal-dim/80">
            <TrendingUp size={12} />
            <span>模型 {evo.model_version}</span>
            <span className="mx-1">·</span>
            <span>样本 {evo.training_samples} + {evo.pending_samples} 待训</span>
            {evo.last_evolve && (
              <>
                <span className="mx-1">·</span>
                <Clock size={11} />
                <span>上次进化 {evo.last_evolve}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- 策略池状态 ---- */}
      {model?.strategy_pool?.pool && model.strategy_pool.pool.length > 0 && (() => {
        const pool = model.strategy_pool;
        return (
        <div className="panel p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Zap size={16} className="text-yellow-400" />
            策略池 · 第 {pool.generation} 代 · {pool.pool.length} 策略竞争
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-terminal-dim">
                  <th className="text-left py-1.5 px-2">#</th>
                  <th className="text-left py-1.5 px-2">版本</th>
                  <th className="text-right py-1.5 px-2">Fitness</th>
                  <th className="text-right py-1.5 px-2">准确率</th>
                  <th className="text-right py-1.5 px-2">Brier</th>
                  <th className="text-right py-1.5 px-2">代</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {pool.pool.slice(0, 5).map((s, i) => (
                  <tr key={s.version} className={s.version === pool.active_id ? 'bg-terminal-accent/5' : ''}>
                    <td className="py-1.5 px-2">
                      <span className={i === 0 ? 'text-yellow-400 font-bold' : 'text-terminal-dim'}>{i + 1}</span>
                      {s.version === pool.active_id && (
                        <span className="text-[9px] text-terminal-accent ml-1">active</span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 font-mono text-terminal-text">{s.version.slice(0, 10)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-terminal-text">{s.fitness.toFixed(3)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">{s.accuracy != null ? `${(s.accuracy * 100).toFixed(0)}%` : '—'}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-terminal-dim">{s.brier?.toFixed(3) ?? '—'}</td>
                    <td className="py-1.5 px-2 text-right text-terminal-dim">{s.generation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        );
      })()}

      {/* ---- 世界模型 ---- */}
      {model?.world_model?.environments && (
        <div className="panel p-4">
          <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
            <Activity size={16} className="text-blue-400" />
            世界模型 · 当前 {model.world_model.current_env}
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(model.world_model.environments as Record<string,{accuracy:number|null;samples:number}>).map(([env, d]: [string, any]) => (
              <div key={env} className={`bg-terminal-card rounded-lg p-2 text-center ${env === model?.world_model?.current_env ? 'ring-1 ring-terminal-accent/50' : ''}`}>
                <div className="text-[10px] text-terminal-dim">{env.replace('趋势','').replace('震荡','').replace('情绪','').replace('恐慌','').replace('冰点','').replace('正常','')}</div>
                <div className={`text-sm font-bold ${d.accuracy != null ? (d.accuracy >= 0.5 ? 'text-emerald-400' : 'text-red-400') : 'text-terminal-dim/50'}`}>
                  {d.accuracy != null ? `${(d.accuracy * 100).toFixed(0)}%` : '—'}
                </div>
                <div className="text-[9px] text-terminal-dim/60">{d.samples}样本</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
