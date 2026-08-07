"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Database,
  Brain,
  Activity,
  AlertTriangle,
  Settings2,
  Clock,
  Cpu,
  HardDrive,
  Server,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Terminal,
} from "lucide-react";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { ScoreBar } from "@/components/ui/Badges";
import { cn } from "@/lib/utils";
import type { EChartsOption } from "echarts";

const EChart = dynamic(() => import("@/components/charts/EChart"), { ssr: false });

const SOURCES = [
  { name: "Twitter 中文流", status: "ok", rate: "12.4k/h", lag: "2s", items: 184320 },
  { name: "微博 Crypto", status: "ok", rate: "3.1k/h", lag: "8s", items: 42180 },
  { name: "链上数据 (多链)", status: "ok", rate: "—", lag: "1s", items: 9821042 },
  { name: "交易所 API", status: "warn", rate: "—", lag: "14s", items: 2194302 },
  { name: "新闻 RSS", status: "ok", rate: "180/h", lag: "30s", items: 8421 },
  { name: "Telegram 频道", status: "down", rate: "0/h", lag: "—", items: 0 },
];

const TASKS = [
  { name: "推文采集", schedule: "实时", next: "持续", status: "running", progress: 100 },
  { name: "AI 热点聚类", schedule: "每 15 分钟", next: "00:08:42", status: "running", progress: 64 },
  { name: "KOL 画像更新", schedule: "每小时", next: "00:42:10", status: "idle", progress: 0 },
  { name: "事件结果追踪", schedule: "每小时", next: "00:21:30", status: "running", progress: 30 },
  { name: "情绪指数计算", schedule: "每 30 分钟", next: "00:04:12", status: "running", progress: 82 },
  { name: "AI 日报生成", schedule: "每日 08:00", next: "14:23:00", status: "idle", progress: 0 },
];

const LOGS = [
  { t: "14:36:42", level: "info", msg: "AI 热点聚类完成，新增 2 个事件 (evt-1, evt-4)" },
  { t: "14:35:18", level: "ok", msg: "ETH ETF 资金数据同步成功 (+3.8亿美元)" },
  { t: "14:34:02", level: "warn", msg: "交易所 API 延迟上升 (14s)，自动降级至 30s 轮询" },
  { t: "14:32:45", level: "info", msg: "KOL 画像更新：0xTodd Trust Score 84 → 85" },
  { t: "14:31:20", level: "err", msg: "Telegram 采集器连接失败，重试 3/5" },
  { t: "14:30:00", level: "ok", msg: "情绪指数计算完成，全市场 68 (+6)" },
  { t: "14:28:33", level: "info", msg: "事件结果追踪：evt-2 24h 结果 +2.3% 已记录" },
];

const levelStyle: Record<string, string> = {
  info: "text-info",
  ok: "text-bull",
  warn: "text-warn",
  err: "text-bear",
};

export default function AdminPage() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const cpu = 42 + (tick % 7);
  const mem = 68 + (tick % 4);
  const qps = 1240 + (tick % 60) * 3;

  const qualityOption: EChartsOption = {
    grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
    tooltip: { trigger: "axis" },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLine: { lineStyle: { color: "#1A2332" } },
      axisLabel: { color: "#5C6A80", fontSize: 9, interval: 4 },
    },
    yAxis: {
      type: "value", max: 100,
      axisLabel: { color: "#5C6A80", fontSize: 9, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.06)" } },
    },
    legend: { textStyle: { color: "#9AA7BC", fontSize: 10 }, bottom: 0, icon: "roundRect", itemWidth: 10, itemHeight: 4 },
    series: [
      {
        name: "去重率", type: "line", smooth: true, symbol: "none",
        data: Array.from({ length: 24 }, (_, i) => 88 + ((i * 7 + tick) % 10)),
        lineStyle: { color: "#16E6C8", width: 2 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(22,230,200,0.25)" }, { offset: 1, color: "rgba(22,230,200,0)" }] } },
      },
      {
        name: "AI 分类准确率", type: "line", smooth: true, symbol: "none",
        data: Array.from({ length: 24 }, (_, i) => 92 + ((i * 5 + tick) % 6)),
        lineStyle: { color: "#5B9DFF", width: 2 },
      },
    ],
  };

  return (
    <div className="space-y-5">
      <SectionHeader index="" icon={<Settings2 className="h-4 w-4" />} title="后台管理" subtitle="数据采集 · AI 分析 · 任务调度 · 数据质量监控 · 模型配置" action={
        <button className="btn h-8 text-xs"><RefreshCw className="h-3.5 w-3.5" /> 刷新</button>
      } />

      {/* system overview */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SysCard icon={<Cpu className="h-4 w-4" />} label="CPU 使用率" value={`${cpu}%`} color="#16E6C8" progress={cpu} />
        <SysCard icon={<HardDrive className="h-4 w-4" />} label="内存使用率" value={`${mem}%`} color="#5B9DFF" progress={mem} />
        <SysCard icon={<Activity className="h-4 w-4" />} label="实时 QPS" value={qps.toLocaleString()} color="#A78BFA" />
        <SysCard icon={<Server className="h-4 w-4" />} label="服务状态" value="5 / 6 正常" color="#FFB020" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* data sources */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Database className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">数据采集状态</h2>
          </div>
          <div className="divide-y divide-line">
            {SOURCES.map((s) => (
              <div key={s.name} className="flex items-center gap-3 px-5 py-2.5">
                <StatusDot status={s.status} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-high">{s.name}</div>
                  <div className="font-mono text-2xs text-ink-low">速率 {s.rate} · 延迟 {s.lag}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-ink-mid tnum">{s.items.toLocaleString()}</div>
                  <div className="text-2xs text-ink-faint">已采集</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* tasks */}
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Clock className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">任务调度</h2>
          </div>
          <div className="divide-y divide-line">
            {TASKS.map((t) => (
              <div key={t.name} className="px-5 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-high">{t.name}</span>
                  <span className={cn("chip text-[9px]", t.status === "running" ? "chip-signal" : "")}>
                    {t.status === "running" ? "运行中" : "待命"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-2xs text-ink-low">
                  <span>{t.schedule}</span>
                  <span className="font-mono tnum">下次 {t.next}</span>
                </div>
                {t.status === "running" && (
                  <div className="mt-1.5"><ScoreBar value={t.progress} color="#16E6C8" height={3} /></div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* data quality */}
        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">数据质量监控</h2>
          </div>
          <p className="mt-0.5 text-2xs text-ink-low">24h 去重率与 AI 分类准确率</p>
          <div className="mt-3"><EChart option={qualityOption} height={200} /></div>
        </Panel>

        {/* AI model config */}
        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">模型配置</h2>
          </div>
          <div className="mt-3 space-y-3">
            <ConfigRow label="聚类模型" value="text-embedding-3-large + HDBSCAN" tag="v2.4" />
            <ConfigRow label="情感分析" value="finbert-zh-crypto" tag="v1.8" />
            <ConfigRow label="重要性评分" value="XGBoost (7 因子)" tag="v3.1" />
            <ConfigRow label="KOL 画像" value="LTR + 时序衰减" tag="v2.0" />
            <ConfigRow label="信号生成" value="多智能体编排" tag="v1.2" />
          </div>
          <div className="mt-4 rounded-lg border border-line bg-bg-base/40 p-3">
            <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">缓存命中率</div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-bold text-signal tnum">94.2%</span>
              <span className="text-2xs text-ink-low">Redis · 命中 1.2M / 1.27M</span>
            </div>
            <ScoreBar value={94.2} color="#16E6C8" height={4} className="mt-2" />
          </div>
        </Panel>
      </div>

      {/* logs + alerts */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3">
            <Terminal className="h-4 w-4 text-signal" />
            <h2 className="font-display text-base font-semibold text-ink-high">系统日志</h2>
            <span className="ml-auto chip-signal text-[9px]"><span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-signal" />实时</span>
          </div>
          <div className="max-h-72 overflow-y-auto p-3 font-mono text-2xs leading-relaxed">
            {LOGS.map((l, i) => (
              <div key={i} className="flex gap-2 px-2 py-1 hover:bg-bg-hover">
                <span className="text-ink-faint tnum">{l.t}</span>
                <span className={cn("uppercase font-semibold", levelStyle[l.level])}>{l.level}</span>
                <span className="text-ink-mid">{l.msg}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <h2 className="font-display text-base font-semibold text-ink-high">报警</h2>
          </div>
          <div className="mt-3 space-y-2">
            <AlertItem level="err" title="Telegram 采集器离线" desc="连接超时，已重试 3 次" time="5 分钟前" />
            <AlertItem level="warn" title="交易所 API 延迟" desc="延迟 14s，已自动降级" time="2 分钟前" />
            <AlertItem level="warn" title="情绪模型置信度偏低" desc="Meme 板块样本量不足" time="18 分钟前" />
            <AlertItem level="info" title="AI 日报预生成完成" desc="明日 08:00 自动发布" time="32 分钟前" />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    ok: { color: "#2EE6A6", label: "正常" },
    warn: { color: "#FFB020", label: "降级" },
    down: { color: "#FF5C7A", label: "离线" },
  };
  const v = map[status];
  return (
    <span className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {status !== "down" && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: v.color }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: v.color }} />
      </span>
      <span className="w-8 text-2xs" style={{ color: v.color }}>{v.label}</span>
    </span>
  );
}

function SysCard({ icon, label, value, color, progress }: { icon: React.ReactNode; label: string; value: string; color: string; progress?: number }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-1.5 text-2xs" style={{ color }}><span className="flex h-7 w-7 items-center justify-center rounded-lg border" style={{ borderColor: `${color}40`, background: `${color}10` }}>{icon}</span>{label}</div>
      <div className="mt-2 font-mono text-2xl font-bold text-ink-high tnum">{value}</div>
      {progress !== undefined && <ScoreBar value={progress} color={color} height={3} className="mt-2" />}
    </Panel>
  );
}

function ConfigRow({ label, value, tag }: { label: string; value: string; tag: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-bg-base/40 px-3 py-2">
      <div>
        <div className="text-sm text-ink-high">{label}</div>
        <div className="font-mono text-2xs text-ink-low">{value}</div>
      </div>
      <span className="chip-signal text-[9px]">{tag}</span>
    </div>
  );
}

function AlertItem({ level, title, desc, time }: { level: string; title: string; desc: string; time: string }) {
  const map: Record<string, string> = { err: "text-bear border-bear/30 bg-bear/5", warn: "text-warn border-warn/30 bg-warn/5", info: "text-info border-info/30 bg-info/5" };
  const Icon = level === "err" ? XCircle : level === "warn" ? AlertTriangle : CheckCircle2;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border p-3", map[level])}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink-high">{title}</div>
        <div className="text-2xs text-ink-low">{desc}</div>
      </div>
      <span className="text-2xs text-ink-faint">{time}</span>
    </div>
  );
}
