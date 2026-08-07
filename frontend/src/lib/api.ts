/**
 * 静态快照数据层 —— 纯前端，读取 ./snapshot/*.json
 *
 * 部署后为静态站点（GitHub Pages），所有数据来自预生成的 JSON 快照。
 * 本地开发时也读同一份 public/snapshot/*.json。
 */

// ============ 通用 fetch 封装 ============

const SNAP_BASE = './snapshot/';
const _cache = new Map<string, unknown>();

async function fetchJSON<T>(filename: string): Promise<T> {
  if (_cache.has(filename)) return _cache.get(filename) as T;
  const res = await fetch(SNAP_BASE + filename);
  if (!res.ok) throw new Error(`快照文件缺失：${filename} (${res.status})`);
  const data = (await res.json()) as T;
  _cache.set(filename, data);
  return data;
}

/** 清除缓存（刷新数据时调用） */
export function clearCache() {
  _cache.clear();
}

// ============ TS 类型定义 ============

/** 快照元信息 */
export interface SnapshotMeta {
  generated_at: string;
  trade_date: string;
  collector: string;
  source_mode: string;
  endpoints: number;
  details: number;
  detail_codes: string[];
  mode: string;
  environment?: string;
  active_strategy?: string;
}

/** limitup.json 中的单条记录 */
export interface LimitUpRecord {
  code: string;
  name: string;
  price: number;
  limit_price: number;
  fb_count: number;       // 连板数
  fd_amount: number;      // 封单额（万元）
  reason: string;
  industry: string;
}

/** limitup.json */
export interface LimitUpSnapshot {
  trade_date: string;
  source: string;
  count: number;
  records: LimitUpRecord[];
}

/** 昨日涨停今日表现 */
export interface PreviousLimitUpRecord {
  trade_date: string;
  code: string;
  name: string;
  industry: string;
  concepts: string[];
  close: number;
  pct_chg: number;
  today_open_pct: number;
  today_pct_chg: number;
  amount: number;
  turnover: number;
  is_broken: boolean;
  reason: string;
}

export interface PreviousLimitUpSnapshot {
  trade_date: string;
  source: string;
  count: number;
  records: PreviousLimitUpRecord[];
}

/** 5 维分项得分 */
export interface SubScores {
  board_strength: number;
  seal_quality: number;
  sector_position: number;
  theme_freshness: number;
  volume_health: number;
}

/** 因果解释 */
export interface ExplainItem {
  dimension: string;
  dimension_cn: string;
  contribution: number;
  desc: string;
}

export interface Explain {
  top_positive: ExplainItem[];
  top_negative: ExplainItem[];
  all_contributions: Record<string, number>;
  summary: string;
}

/** ranking.json / scanner_potential.json 中的单条记录 */
export interface ScoredRecord {
  rank: number;
  code: string;
  name: string;
  boards: number;
  price: number;
  industry?: string;
  concepts?: string[];
  total_score: number;
  sub_scores: SubScores;
  abs_grade: string;       // 绝对评级 S/A/B/C/D
  rel_grade: string;       // 相对评级 S/A/B/C/D
  percentile: number;
  reason: string;
  explain: Explain;
  seal_time?: string;
  break_times?: number;
  limit_type?: string;
  float_mv?: number;
  turnover?: number;
  amount?: number;
}

/** ranking.json */
export interface RankingSnapshot {
  trade_date: string;
  source: string;
  count: number;
  environment: string;
  active_strategy: string;
  ranking: ScoredRecord[];
}

/** scanner_potential.json */
export interface ScannerSnapshot {
  trade_date: string;
  source: string;
  total_candidates: number;
  environment: string;
  active_strategy: string;
  weights: Record<string, number>;
  ranking: ScoredRecord[];
}

/** dashboard.json */
export interface DashboardSnapshot {
  snapshot: {
    trade_date: string;
    limit_up_count: number;
    limit_down_count: number;
    broken_count?: number;
    break_rate: number;
    max_boards: number;
    consecutive_count: number;
    up_count: number;
    down_count: number;
    flat_count?: number;
    sentiment_index: number;
    profit_effect: number;
    loss_effect: number;
    temperature: number;
    cycle: string;
    total_amount: number;
    net_capital: number;
    north_capital: number;
    margin_balance: number;
    hot_sectors: { name: string; heat: number; limit_up_count: number }[];
    index_quotes: Record<string, number>;
  };
  hot_themes: { name: string; count: number; leader: string; amount: number }[];
  collector: string;
  data_time: string;
}

/** 基因参数（打分函数阈值，进化时变异） */
export interface GeneParams {
  board_peak: number;
  board_decay_start: number;
  seal_strong_ratio: number;
  theme_golden_low: number;
  theme_golden_high: number;
  theme_overheat: number;
  vol_healthy_low: number;
  vol_healthy_high: number;
  vol_too_high: number;
}

/** health_pool.json */
export interface StrategyEntry {
  version: string;
  style: string;
  style_desc: string;
  fitness: number;
  accuracy: number;          // is_up_next 次日上涨准确率
  brier: number;
  acc_limit?: number;        // is_limit_up_next 次日继续涨停准确率
  acc_open?: number;         // is_open_up 次日红盘开盘准确率
  rank_corr?: number;        // 预测概率 vs next_pct 秩相关 [-1,1]
  generation: number;
  samples_tested: number;
  weights: Record<string, number>;
  gene_params?: GeneParams;  // 策略携带的打分基因
}

export interface HealthPoolSnapshot {
  generation: number;
  total_evolves: number;
  active_id: string;
  active_style: string;
  active_gene?: GeneParams;   // 主策略基因参数
  pool: StrategyEntry[];
}

/** health_world.json */
export interface WorldEnvSignal {
  zt_count: number;
  avg_turnover: number;
  board_ratio: number;
  up_ratio: number;
  avg_boards: number;
  max_boards: number;
  limit_down_count: number;
  break_rate: number;
}

export interface HealthWorldSnapshot {
  environment: string;
  env_description: string;
  signals: WorldEnvSignal;
  weight_adjustments: Record<string, number>;
  confidence_factor: number;
  all_envs: { name: string; description: string }[];
}

/** analysis_industry.json */
export interface IndustryAnalysisSnapshot {
  trade_date: string;
  industries: {
    name: string;
    count: number;
    total_amount: number;
    avg_change: number;
    leaders: { code: string; name: string; boards: number }[];
  }[];
}

/** analysis_theme.json */
export interface ThemeAnalysisSnapshot {
  trade_date: string;
  themes: {
    name: string;
    count: number;
    leader: string;
    leader_code: string;
    amount: number;
    avg_change: number;
    boards_max: number;
  }[];
}

/** analysis_sentiment.json */
export interface SentimentSnapshot {
  trade_date: string;
  score: number;
  [key: string]: unknown;
}

/** learning_stats.json */
export interface LearningStatsSnapshot {
  model_version: string;
  total_predictions: number;
  accuracy: number;
  [key: string]: unknown;
}

/** health_model.json */
export interface HealthModelSnapshot {
  health_score: number;
  health_status: string;
  model_version: string;
  model_trained_at: string;
  total_verifications: number;
  total_predictions: number;
  training_samples: number;
  pending_samples: number;
  evolve_cycles: number;
  last_evolve: string | null;
  recent_accuracy: number | null;
  recent_accuracy_3avg: number | null;
  avg_brier: number | null;
  prediction_uncertainty: number;
  active_anomalies: number;
  anomalies: { type: string; detected: string; detail: string; status: string }[];
  accuracy_trend: { timestamp: string; accuracy: number }[];
  strategy_pool?: {
    generation: number;
    active_id: string;
    total_evolves: number;
    pool: { version: string; fitness: number; accuracy: number; brier: number; acc_limit?: number; acc_open?: number; rank_corr?: number; generation: number; weights: Record<string, number>; gene_params?: GeneParams }[];
  };
  world_model?: {
    current_env: string;
    total_observations: number;
    environments: Record<string, { accuracy: number | null; samples: number; last_seen: string }>;
  };
}

/** 最近一代进化记录（含多目标指标 + 基因） */
export interface EvolutionRecord {
  timestamp: string;
  generation: number;
  best_version: string;
  best_style: string;
  best_fitness: number;
  best_accuracy: number;
  acc_limit: number;
  acc_open: number;
  rank_corr: number;
  best_brier: number;
  improvement: number;
}

/** 进化系统实时策略池状态 */
export interface EvolutionStrategyPool {
  generation: number;
  total_evolves: number;
  active_style: string;
  active_fitness: number;
  active_accuracy: number;
  active_acc_limit: number;
  active_acc_open: number;
  active_rank_corr: number;
  active_brier: number;
}

/** health_evolution.json */
export interface EvolutionHealthSnapshot {
  evolve_cycles: number;
  evolution_stage: string;
  evolution_stage_label: string;
  next_stage_in: number | null;
  last_evolve: string | null;
  model_version: string;
  learnings_count: number;
  learnings_pending: number;
  errors_count: number;
  active_anomalies: number;
  training_samples: number;
  pending_samples: number;
  retrain_recommended: boolean;
  strategy_pool?: EvolutionStrategyPool;
  last_evolution?: EvolutionRecord;
  evolution_trend?: EvolutionRecord[];
}

/** dates.json */
export interface DatesSnapshot {
  dates: string[];
}

// ============ API 函数 ============

export const api = {
  meta: () => fetchJSON<SnapshotMeta>('meta.json'),
  dashboard: () => fetchJSON<DashboardSnapshot>('dashboard.json'),
  limitup: () => fetchJSON<LimitUpSnapshot>('limitup.json'),
  limitupPrevious: () => fetchJSON<PreviousLimitUpSnapshot>('limitup_previous.json'),
  ranking: () => fetchJSON<RankingSnapshot>('ranking.json'),
  scanner: () => fetchJSON<ScannerSnapshot>('scanner_potential.json'),
  healthPool: () => fetchJSON<HealthPoolSnapshot>('health_pool.json'),
  healthWorld: () => fetchJSON<HealthWorldSnapshot>('health_world.json'),
  healthModel: () => fetchJSON<HealthModelSnapshot>('health_model.json'),
  healthEvolution: () => fetchJSON<EvolutionHealthSnapshot>('health_evolution.json'),
  industry: () => fetchJSON<IndustryAnalysisSnapshot>('analysis_industry.json'),
  theme: () => fetchJSON<ThemeAnalysisSnapshot>('analysis_theme.json'),
  sentiment: () => fetchJSON<SentimentSnapshot>('analysis_sentiment.json'),
  learningStats: () => fetchJSON<LearningStatsSnapshot>('learning_stats.json'),
  learningLogs: () => fetchJSON<{ logs: unknown[] }>('learning_logs.json'),
  backtest: () => fetchJSON<unknown>('learning_backtest.json'),
  dates: () => fetchJSON<DatesSnapshot>('dates.json'),
  dragon: () => fetchJSON<{ trade_date: string; records: unknown[] }>('analysis_dragon.json'),
};
