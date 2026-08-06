/**
 * 设置页
 * 模型健康卡片 + 快照元信息 + 数据源信息 + 刷新缓存
 */

import { useEffect, useState, type ReactNode } from 'react';
import {
  Database,
  RefreshCw,
  Server,
  Tag,
  Cpu,
  Calendar,
  FileText,
  Layers,
} from 'lucide-react';
import { api, clearCache, type SnapshotMeta } from '../lib/api';
import ModelHealthCard from '../components/ModelHealthCard';

export default function Settings() {
  const [meta, setMeta] = useState<SnapshotMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .meta()
      .then((m) => {
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        if (!cancelled) setError('快照元信息加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      clearCache();
      const m = await api.meta();
      setMeta(m);
    } catch {
      setError('刷新缓存失败');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* 标题 + 刷新按钮 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">设置</h1>
          <p className="text-sm text-terminal-dim mt-1">
            静态快照模式 · 数据源信息与模型健康监控
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-primary flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? '刷新中...' : '刷新缓存'}
        </button>
      </div>

      {error && (
        <div className="panel border-red-400/30 bg-red-400/5 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 模型健康卡片 */}
      <ModelHealthCard />

      {/* 快照元信息 */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-terminal-accent" />
            <span className="text-sm font-medium">快照元信息</span>
          </div>
          {meta?.mode && (
            <span className="text-xs text-terminal-dim">{meta.mode}</span>
          )}
        </div>
        <div className="panel-body">
          {loading ? (
            <div className="text-sm text-terminal-dim">加载中...</div>
          ) : meta ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <MetaRow
                icon={<Calendar size={14} />}
                label="生成时间"
                value={meta.generated_at ?? '—'}
              />
              <MetaRow
                icon={<Calendar size={14} />}
                label="交易日"
                value={meta.trade_date ?? '—'}
              />
              <MetaRow
                icon={<Server size={14} />}
                label="采集器"
                value={meta.collector ?? '—'}
              />
              <MetaRow
                icon={<Database size={14} />}
                label="数据源模式"
                value={meta.source_mode ?? '—'}
              />
              <MetaRow
                icon={<Cpu size={14} />}
                label="运行环境"
                value={meta.environment ?? '—'}
              />
              <MetaRow
                icon={<Tag size={14} />}
                label="当前策略"
                value={meta.active_strategy ?? '—'}
              />
            </div>
          ) : (
            <div className="text-sm text-terminal-dim">暂无快照元信息</div>
          )}
        </div>
      </div>

      {/* 数据源信息 */}
      <div className="panel">
        <div className="panel-header">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-terminal-accent" />
            <span className="text-sm font-medium">数据源信息</span>
          </div>
        </div>
        <div className="panel-body space-y-2 text-sm text-terminal-dim">
          <p>
            当前部署为静态快照模式，所有数据来自预生成的 JSON 快照文件（
            <span className="font-mono text-terminal-text">./snapshot/*.json</span>）。
          </p>
          {meta && (
            <ul className="space-y-1 mt-2">
              <li>
                · 快照端点数：
                <span className="text-terminal-text font-mono">
                  {meta.endpoints ?? '—'}
                </span>
              </li>
              <li>
                · 详情条目数：
                <span className="text-terminal-text font-mono">
                  {meta.details ?? '—'}
                </span>
              </li>
              <li>
                · 采集器：
                <span className="text-terminal-text">{meta.collector ?? '—'}</span>
              </li>
              <li>
                · 模式：
                <span className="text-terminal-text">{meta.mode ?? '—'}</span>
              </li>
            </ul>
          )}
          <p className="text-xs text-terminal-dim/70 mt-3 flex items-start gap-1">
            <Layers size={12} className="mt-0.5 shrink-0" />
            点击右上角「刷新缓存」可清除前端缓存并重新拉取快照。
          </p>
        </div>
      </div>

      <div className="text-xs text-terminal-dim mt-8">
        Limit-Up Quant AI v1.0 · 用于 A 股短线量化研究与学习 · 不构成投资建议
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-terminal-dim shrink-0">{icon}</span>
      <span className="text-terminal-dim text-xs w-20 shrink-0">{label}</span>
      <span className="text-terminal-text font-mono text-xs break-all">
        {value}
      </span>
    </div>
  );
}
