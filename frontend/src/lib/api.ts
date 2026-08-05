/**
 * API 层 —— 双模式自适应
 *
 *   实时模式（live）  ：检测到 FastAPI 后端 → 请求 /api/*
 *   静态模式（static）：无后端（公网静态托管）→ 自动降级读 ./snapshot/*.json
 *
 * 首次调用时探测一次 /api/health，结果缓存于内存 + sessionStorage。
 * 这样同一份构建产物，本地可实时、公网可离线，无需两套代码。
 */
const BASE = '/api';
const SNAP = 'snapshot';

export type ApiMode = 'live' | 'static';
let _mode: ApiMode | null = null;
let _probe: Promise<ApiMode> | null = null;

export function currentMode(): ApiMode {
  return _mode ?? 'live';
}

async function probeMode(): Promise<ApiMode> {
  if (_mode) return _mode;
  if (_probe) return _probe;
  _probe = (async (): Promise<ApiMode> => {
    try {
      const cached = sessionStorage.getItem('luq_mode');
      if (cached === 'live' || cached === 'static') {
        _mode = cached;
        return _mode;
      }
    } catch { /* sessionStorage 不可用时忽略 */ }
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 3500);
      const res = await fetch(`${BASE}/health`, { signal: ctl.signal });
      clearTimeout(timer);
      // 静态托管常带 SPA fallback：/api/health 会返回 200 + index.html，
      // 因此必须校验 content-type 与响应体结构，不能只看 res.ok。
      const ct = res.headers.get('content-type') ?? '';
      if (res.ok && ct.includes('json')) {
        const body = await res.json();
        _mode = body && typeof body === 'object' && 'status' in body ? 'live' : 'static';
      } else {
        _mode = 'static';
      }
    } catch {
      _mode = 'static';
    }
    try { sessionStorage.setItem('luq_mode', _mode); } catch { /* ignore */ }
    return _mode;
  })();
  return _probe;
}

/** API 路径 → 静态快照文件名 */
const SNAP_MAP: Record<string, string> = {
  '/health': 'health.json',
  '/dashboard': 'dashboard.json',
  '/limitup': 'limitup.json',
  '/limitup/ranking': 'ranking.json',
  '/limitup/dates': 'dates.json',
  '/analysis/industry': 'analysis_industry.json',
  '/analysis/theme': 'analysis_theme.json',
  '/analysis/sentiment': 'analysis_sentiment.json',
  '/analysis/dragon': 'analysis_dragon.json',
  '/learning/stats': 'learning_stats.json',
  '/learning/backtest': 'learning_backtest.json',
  '/learning/logs': 'learning_logs.json',
  '/learning/calibration': 'learning_calibration.json',
  '/scanner/potential': 'scanner_potential.json',
  '/health/model': 'health_model.json',
  '/health/evolution': 'health_evolution.json',
  '/health/pool': 'health_pool.json',
  '/health/world': 'health_world.json',
};

function toSnapshotFile(path: string): string | null {
  const clean = path.split('?')[0];
  if (SNAP_MAP[clean]) return SNAP_MAP[clean];
  const m = clean.match(/^\/detail\/([A-Za-z0-9]+)$/);
  if (m) return `detail/${m[1]}.json`;
  return null;
}

const _snapCache = new Map<string, unknown>();

async function getStatic<T>(path: string): Promise<T> {
  const file = toSnapshotFile(path);
  if (!file) throw new Error(`离线快照模式暂不支持该接口：${path}`);
  if (_snapCache.has(file)) return _snapCache.get(file) as T;
  const res = await fetch(`${SNAP}/${file}`);
  if (!res.ok) throw new Error(`快照文件缺失：${file}`);
  const data = (await res.json()) as T;
  _snapCache.set(file, data);
  return data;
}

async function get<T>(path: string): Promise<T> {
  if ((await probeMode()) === 'static') return getStatic<T>(path);
  try {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    // 实时后端中途不可用 → 尝试快照兜底
    if (toSnapshotFile(path)) {
      _mode = 'static';
      return getStatic<T>(path);
    }
    throw err;
  }
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export interface SnapshotMeta {
  generated_at: string;
  trade_date: string;
  collector: string;
  endpoints: number;
  details: number;
  detail_codes: string[];
  mode: string;
}

/** 读取静态快照元信息（实时模式下返回 null） */
export async function snapshotMeta(): Promise<SnapshotMeta | null> {
  try {
    const res = await fetch(`${SNAP}/meta.json`);
    return res.ok ? ((await res.json()) as SnapshotMeta) : null;
  } catch {
    return null;
  }
}

export interface DashboardData {
  snapshot: {
    trade_date: string; limit_up_count: number; limit_down_count: number;
    consecutive_count: number; max_boards: number; break_rate: number;
    up_count: number; down_count: number;
    sentiment_index: number; profit_effect: number; loss_effect: number;
    temperature: number; cycle: string; total_amount: number;
    net_capital: number; north_capital: number; margin_balance: number;
    hot_sectors: { name: string; heat: number; limit_up_count: number }[];
    index_quotes: Record<string, number>;
  };
  hot_themes: { name: string; count: number; leader: string; amount: number }[];
  collector: string; data_time: string;
}

export interface LimitUpRecord {
  trade_date: string; code: string; name: string; industry: string;
  concepts: string[]; pct_chg: number; boards: number;
  amount: number; turnover: number; seal_time: string;
  break_times: number; seal_ratio: number; main_net_inflow: number;
  has_dragon: boolean; float_mv: number; limit_type: string; reason: string;
}

export interface AiRanking {
  trade_date: string; count: number;
  ranking: {
    rank: number; code: string; name: string;
    prob_limit_up: number; prob_up: number; prob_big_up: number;
    total_score: number; grade: string; rel_grade?: string; percentile?: number;
    risk_level: string; advice: string;
    boards: number; reasons: string[];
  }[];
}

export interface StockDetail {
  trade_date: string;
  stock: { code: string; name: string; exchange: string; board: string; industry: string; concepts: string[]; total_mv: number; float_mv: number; limit_pct: number } | null;
  limit_up_record: LimitUpRecord | null;
  quotes: { code: string; trade_date: string; open: number; high: number; low: number; close: number; volume: number; turnover: number }[];
  dragon_tiger: { seat: string; seat_type: string; tag: string; buy: number; sell: number; net: number }[];
  news: { title: string; source: string; sentiment: number; kind: string }[];
  prediction: any;
}

export interface BacktestResult {
  trade_date: string; next_date: string; total: number;
  limit_up_count: number; up_count: number; avg_return: number;
  top10_precision: number; top20_precision: number;
  win_rate: number; profit_loss_ratio: number;
  max_drawdown: number; cumulative_return: number;
  results: { rank: number; code: string; name: string; prob_limit_up: number; grade: string; actual_pct: number; actual_limit_up: boolean; hit: boolean }[];
}

export interface LearningStats {
  total_predictions: number; verified_count: number; accuracy: number;
  top10_precision: number; top20_precision: number;
  win_rate: number; profit_loss_ratio: number; max_drawdown: number;
  cumulative_return: number; active_model: string;
  model_versions: { version: string; trained_at: string; accuracy: number; brier: number; samples: number }[];
}

export interface PotentialStock {
  rank: number; rank_label: string; code: string; name: string;
  change_pct: number; price: number; limit_price: number;
  amount: number; float_mv: number; total_mv: number;
  turnover: number; vol_ratio: number; speed: number;
  is_new_high: boolean; zt_stat: string; reason: string; industry: string;
  trend_5d: number; total_score: number; grade: string;
  proximity_score: number; volume_score: number; streak_score: number;
  new_high_score: number; turnover_score: number; reasons: string[];
  rel_grade?: string; percentile?: number;
}
export interface PotentialScanResult { trade_date: string; total_candidates: number; ranking: PotentialStock[]; }

export interface ModelHealth {
  health_score: number; health_status: string;
  model_version: string; model_trained_at: string;
  total_verifications: number; total_predictions: number;
  training_samples: number; pending_samples: number;
  evolve_cycles: number; last_evolve: string | null;
  recent_accuracy: number | null; recent_accuracy_3avg: number | null;
  avg_brier: number | null; prediction_uncertainty: number;
  active_anomalies: number; anomalies: {type:string;detected:string;detail:string;status:string}[];
  accuracy_trend: {timestamp:string;accuracy:number}[];
  strategy_pool?: { generation: number; active_id: string; total_evolves: number;
    pool: { version: string; fitness: number; accuracy: number; brier: number; generation: number; weights: Record<string,number> }[];
  };
  world_model?: { current_env: string; total_observations: number;
    environments: Record<string, { accuracy: number|null; samples: number; last_seen: string }>;
  };
}
export interface EvolutionHealth {
  evolve_cycles: number; evolution_stage: string; evolution_stage_label: string;
  next_stage_in: number | null; last_evolve: string | null;
  model_version: string; learnings_count: number; learnings_pending: number;
  errors_count: number; active_anomalies: number;
  training_samples: number; pending_samples: number; retrain_recommended: boolean;
}

// --- API ---
export const api = {
  dashboard: () => get<DashboardData>('/dashboard'),
  health: () => get<{ status: string }>('/health'),
  limitup: (date?: string) => get<{ trade_date: string; count: number; records: LimitUpRecord[] }>(`/limitup${date ? `?trade_date=${date}` : ''}`),
  ranking: (date?: string) => get<AiRanking>(`/limitup/ranking${date ? `?trade_date=${date}` : ''}`),
  dates: () => get<{ dates: string[] }>('/limitup/dates'),
  detail: (code: string, date?: string) => get<StockDetail>(`/detail/${code}${date ? `?trade_date=${date}` : ''}`),
  industry: (date?: string) => get<{ trade_date: string; industries: any[] }>(`/analysis/industry${date ? `?trade_date=${date}` : ''}`),
  theme: (date?: string) => get<{ trade_date: string; themes: any[] }>(`/analysis/theme${date ? `?trade_date=${date}` : ''}`),
  sentiment: (date?: string) => get<any>('/analysis/sentiment'),
  dragon: (date?: string) => get<any>('/analysis/dragon'),
  potential: (date?: string, limit?: number) => get<PotentialScanResult>(`/scanner/potential${date ? `?trade_date=${date}` : ''}${limit ? `${date ? '&' : '?'}limit=${limit}` : ''}`),
  modelHealth: () => get<ModelHealth>('/health/model'),
  evolutionHealth: () => get<EvolutionHealth>('/health/evolution'),
  learningStats: () => get<LearningStats>('/learning/stats'),
  backtest: (date?: string) => get<BacktestResult>(`/learning/backtest${date ? `?trade_date=${date}` : ''}`),
  learningLogs: (limit?: number) => get<{ logs: any[] }>(`/learning/logs${limit ? `?limit=${limit}` : ''}`),
  chat: async (message: string): Promise<{ reply: string }> => {
    if ((await probeMode()) === 'static') return { reply: await offlineChat(message) };
    try {
      return await post<{ reply: string }>('/chat', { message });
    } catch {
      _mode = 'static';
      return { reply: await offlineChat(message) };
    }
  },
  mode: () => currentMode(),
  meta: snapshotMeta,
};

// ---------------------------------------------------------------------------
// 离线推理引擎：静态模式下基于快照数据实时计算回答（非预置文案）
// ---------------------------------------------------------------------------
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

async function offlineChat(msg: string): Promise<string> {
  const q = msg.trim();
  let rank: AiRanking | null = null;
  let dash: DashboardData | null = null;
  try { rank = await getStatic<AiRanking>('/limitup/ranking'); } catch { /* ignore */ }
  try { dash = await getStatic<DashboardData>('/dashboard'); } catch { /* ignore */ }

  if (!rank || !rank.ranking?.length) {
    return '离线快照中暂无排行榜数据，请在收盘后重新生成快照。';
  }
  const list = rank.ranking;
  const s = dash?.snapshot;

  // 命中股票代码或名称 → 单股解读
  const hit = list.find(r => q.includes(r.code) || (r.name && q.includes(r.name)));
  if (hit) {
    return [
      `【${hit.name} ${hit.code}】当前排名第 ${hit.rank} 位。`,
      `继续涨停概率 ${pct(hit.prob_limit_up)}，继续上涨概率 ${pct(hit.prob_up)}，综合评分 ${hit.total_score.toFixed(1)}。`,
      `AI 评级 ${hit.grade} 级，风险等级${hit.risk_level}，当前 ${hit.boards} 连板。`,
      hit.reasons?.length ? `\n模型给出的关键依据：\n${hit.reasons.map(r => `· ${r}`).join('\n')}` : '',
      `\n操作建议：${hit.advice}`,
    ].filter(Boolean).join('\n');
  }

  // 为什么排第一
  if (/第一|排首|榜首|最高分|top ?1|龙头/i.test(q)) {
    const t = list[0];
    return [
      `排名第一的是 ${t.name}（${t.code}），继续涨停概率 ${pct(t.prob_limit_up)}，综合评分 ${t.total_score.toFixed(1)}，${t.grade} 级。`,
      t.reasons?.length ? `\n它排第一的原因：\n${t.reasons.map(r => `· ${r}`).join('\n')}` : '',
      `\n风险等级${t.risk_level}，建议：${t.advice}`,
    ].filter(Boolean).join('\n');
  }

  // 风险最大
  if (/风险|危险|不要碰|规避|最危险/.test(q)) {
    const risky = [...list].sort((a, b) => a.prob_limit_up - b.prob_limit_up).slice(0, 5);
    return [
      '模型判定风险最高的 5 只（继续涨停概率最低）：',
      ...risky.map((r, i) => `${i + 1}. ${r.name}（${r.code}）概率 ${pct(r.prob_limit_up)}，${r.grade} 级，风险${r.risk_level}，${r.boards} 连板`),
      '\n共性风险：高位连板 + 概率偏低，次日容易一字低开或炸板，接力性价比差。',
    ].join('\n');
  }

  // 值得关注
  if (/关注|推荐|买|值得|机会|打板/.test(q)) {
    const top = list.slice(0, 5);
    return [
      `今日 AI 排行榜前 5（共 ${list.length} 只涨停股）：`,
      ...top.map(r => `${r.rank}. ${r.name}（${r.code}）${pct(r.prob_limit_up)} · ${r.grade} 级 · ${r.boards} 板 · ${r.advice}`),
      s ? `\n当前市场处于「${s.cycle}」阶段，情绪温度 ${s.temperature}°，赚钱效应 ${s.profit_effect}%。` : '',
      '\n提示：排行榜是概率排序，不是买入指令。务必结合次日竞价承接情况决策。',
    ].filter(Boolean).join('\n');
  }

  // 市场情绪
  if (/情绪|大盘|市场|行情|周期|温度/.test(q)) {
    if (!s) return '快照中缺少大盘数据。';
    const grades = list.reduce<Record<string, number>>((a, r) => { a[r.grade] = (a[r.grade] || 0) + 1; return a; }, {});
    return [
      `【${s.trade_date} 市场情绪】`,
      `情绪周期：${s.cycle}　温度：${s.temperature}°　情绪指数：${s.sentiment_index}`,
      `涨停 ${s.limit_up_count} 家，其中连板 ${s.consecutive_count} 家，最高 ${s.max_boards} 板；跌停 ${s.limit_down_count} 家。`,
      `赚钱效应 ${s.profit_effect}%，亏钱效应 ${s.loss_effect}%。`,
      s.hot_sectors?.length ? `热点方向：${s.hot_sectors.slice(0, 5).map(x => `${x.name}(${x.limit_up_count})`).join('、')}` : '',
      `\nAI 评级分布：${Object.entries(grades).map(([g, c]) => `${g}级${c}只`).join('　')}`,
    ].filter(Boolean).join('\n');
  }

  // 连板 / 高度
  if (/连板|几板|高度|空间板/.test(q)) {
    const multi = list.filter(r => r.boards >= 2).sort((a, b) => b.boards - a.boards);
    if (!multi.length) return '今日无连板个股，市场处于断板状态，接力风险较高。';
    return [
      `今日连板梯队（共 ${multi.length} 只）：`,
      ...multi.slice(0, 10).map(r => `${r.boards} 板　${r.name}（${r.code}）　概率 ${pct(r.prob_limit_up)}　${r.grade} 级`),
      `\n最高板：${multi[0].boards} 板 ${multi[0].name}。连板高度决定情绪天花板，梯队断层往往预示退潮。`,
    ].join('\n');
  }

  // 默认：概览 + 引导
  const avg = list.reduce((a, r) => a + r.prob_limit_up, 0) / list.length;
  return [
    `当前为离线快照模式，数据截止 ${rank.trade_date}，共 ${list.length} 只涨停股。`,
    `全场平均继续涨停概率 ${pct(avg)}，榜首 ${list[0].name}（${list[0].code}）${pct(list[0].prob_limit_up)}。`,
    '\n你可以这样问我：',
    '· 为什么 XX 排第一？',
    '· 今天哪些股票值得关注？',
    '· 今天哪些股票风险最大？',
    '· 当前市场情绪如何？',
    '· 连板梯队是什么情况？',
    '· 直接输入股票代码或名称，看单股解读',
  ].join('\n');
}
