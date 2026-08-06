/**
 * AI 学习系统页
 * 展示进化阶段 + 模型健康卡片 + 学习统计 + 进化日志
 */

import { useEffect, useState } from 'react';
import { Zap, Clock, RefreshCw, Activity, ListChecks } from 'lucide-react';
import {
  api,
  type EvolutionHealthSnapshot,
  type LearningStatsSnapshot,
} from '../lib/api';
import ModelHealthCard from '../components/ModelHealthCard';

type LogEntry = {
  id?: string | number;
  event?: string;
  level?: string;
  summary?: string;
  message?: string;
  detail?: string;
  trade_date?: string;
  created_at?: string;
  timestamp?: string;
  [key: string]: unknown;
};

export default function LearningSystem() {
  const [evolution, setEvolution] = useState<EvolutionHealthSnapshot | null>(null);
  const [stats, setStats] = useState<LearningStatsSnapshot | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.allSettled([
      api.healthEvolution(),
      api.learningStats(),
      api.learningLogs(),
    ]).then(([e, s, l]) => {
      if (cancelled) return;
      if (e.status === 'fulfilled') setEvolution(e.value);
      if (s.status === 'fulfilled') setStats(s.value);
      if (l.status === 'fulfilled') setLogs((l.value.logs ?? []) as LogEntry[]);
      if (e.status === 'rejected' && s.status === 'rejected' && l.status === 'rejected') {
        setError('学习系统数据加载失败');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-terminal-dim">
        加载 AI 学习系统数据...
      </div>
    );
  }

  const modelVersion = evolution?.model_version ?? stats?.model_version ?? '—';

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Zap size={20} className="text-terminal-accent" />
          AI 学习系统
        </h1>
        <p className="text-sm text-terminal-dim mt-1">
          全自动预测 → 验证 → 进化闭环 · 模型版本
          <span className="text-terminal-accent ml-1">{modelVersion}</span>
        </p>
      </div>

      {error && (
        <div className="panel border-red-400/30 bg-red-400/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 顶部：进化阶段卡片 */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-terminal-accent" />
            <span className="text-sm font-medium">进化阶段</span>
          </div>
          <span className="text-xs text-terminal-accent">
            {evolution?.evolution_stage_label ?? '—'}
          </span>
        </div>
        <div className="panel-body grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat
            label="当前阶段"
            value={evolution?.evolution_stage_label ?? '—'}
          />
          <Stat label="进化次数" value={evolution?.evolve_cycles ?? 0} mono />
          <Stat
            label="上次进化"
            value={evolution?.last_evolve ?? '尚未进化'}
          />
          <Stat label="训练样本数" value={evolution?.training_samples ?? 0} mono />
        </div>
        {evolution && evolution.next_stage_in != null && (
          <div className="px-4 pb-4 text-xs text-terminal-dim flex items-center gap-1">
            <Clock size={12} />
            距离下一阶段还需 {evolution.next_stage_in} 次进化
          </div>
        )}
      </div>

      {/* 中部：模型健康卡片 */}
      <ModelHealthCard />

      {/* 底部：学习统计 + 进化日志 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 学习统计 */}
        <div className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ListChecks size={16} className="text-terminal-accent" />
              <span className="text-sm font-medium">学习统计</span>
            </div>
          </div>
          <div className="panel-body space-y-3">
            {stats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Kpi
                    label="总预测数"
                    value={stats.total_predictions ?? 0}
                  />
                  <Kpi
                    label="准确率"
                    value={`${((stats.accuracy ?? 0) * 100).toFixed(1)}%`}
                    accent
                  />
                </div>
                <div className="text-xs text-terminal-dim">
                  模型版本：
                  <span className="text-terminal-accent">
                    {stats.model_version ?? '—'}
                  </span>
                </div>
              </>
            ) : (
              <div className="text-sm text-terminal-dim">暂无学习统计数据</div>
            )}
          </div>
        </div>

        {/* 进化日志 */}
        <div className="panel lg:col-span-2">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <RefreshCw size={16} className="text-terminal-accent" />
              <span className="text-sm font-medium">进化日志</span>
            </div>
            <span className="text-xs text-terminal-dim">{logs.length} 条</span>
          </div>
          <div className="panel-body">
            {logs.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {logs.map((l, i) => (
                  <LogRow key={l.id ?? i} log={l} />
                ))}
              </div>
            ) : (
              <div className="text-sm text-terminal-dim">暂无进化日志</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-terminal-dim mb-1">{label}</div>
      <div
        className={`text-sm text-terminal-text break-words ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="bg-terminal-card rounded p-3 text-center">
      <div
        className={`text-xl font-bold font-mono ${
          accent ? 'text-terminal-accent' : 'text-terminal-text'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-terminal-dim mt-1">{label}</div>
    </div>
  );
}

function LogRow({ log }: { log: LogEntry }) {
  const event = log.event ?? log.level ?? 'info';
  const text =
    log.summary ?? log.message ?? (typeof log.detail === 'string' ? log.detail : '');
  const time = log.created_at ?? log.timestamp ?? log.trade_date ?? '';
  const eventColor: string =
    event === 'verify'
      ? 'text-blue-400'
      : event === 'retrain' || event === 'evolve'
        ? 'text-green-400'
        : event === 'error' || event === 'warn'
          ? 'text-orange-400'
          : 'text-terminal-dim';
  return (
    <div className="flex items-start gap-3 text-sm p-2 bg-terminal-card/30 rounded">
      <span className={`text-[11px] font-bold whitespace-nowrap ${eventColor}`}>
        [{event}]
      </span>
      <div className="flex-1 min-w-0">
        {text ? (
          <div className="text-xs text-terminal-text break-words">{text}</div>
        ) : null}
        {time ? (
          <div className="text-[11px] text-terminal-dim mt-0.5">{time}</div>
        ) : null}
      </div>
    </div>
  );
}
