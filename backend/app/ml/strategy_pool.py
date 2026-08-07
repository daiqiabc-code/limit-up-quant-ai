"""策略池：5 维评分权重 + 参数化基因 的多策略竞争 + 遗传进化。

维护 5 个风格各异的策略个体，每个个体携带：
  - weights: 5 维评分权重（决定各维度重要性）
  - gene_params: 打分函数参数基因（决定打分函数本身的阈值/区间）

通过历史命中率的 fitness 竞争 + 精英保留 + 交叉 + 变异 实现自动优化。
进化搜索空间 = 权重空间 ∪ 基因参数空间，比单纯调权更丰富。

5 维度:
  board_strength   连板强度
  seal_quality     封单质量
  sector_position  板块地位
  theme_freshness  题材新鲜度
  volume_health    量价健康

数据持久化到 storage/ml_models/strategy_pool.json
"""

import copy
import json
import os
import random
from datetime import datetime
from typing import Any

from app.config import settings
from app.ml.scoring import (
    FIVE_DIM_WEIGHTS,
    GeneParams,
    DEFAULT_GENE,
    GENE_BOUNDS,
    clip_gene,
    _score_board_strength,
    _score_seal_quality,
    _score_theme_freshness,
    _score_volume_health,
)

POOL_PATH = os.path.join(settings.ML_MODEL_DIR, "strategy_pool.json")

# 5 维权重键（固定，不随模型版本变化）
WEIGHT_KEYS = list(FIVE_DIM_WEIGHTS.keys())

# 基因参数键（用于交叉/变异遍历）
GENE_KEYS = list(GENE_BOUNDS.keys())


# ====================================================================
# 5 种策略风格定义
# ====================================================================

STRATEGY_STYLES = [
    {
        "name": "连板偏好型",
        "desc": "偏好高连板个股，认为连板动能是接力的核心信号",
        "weights": {"board_strength": 0.40, "seal_quality": 0.15, "sector_position": 0.15, "theme_freshness": 0.15, "volume_health": 0.15},
        # 偏好高连板 → 峰值连板设高，衰减延后
        "gene": GeneParams(board_peak=6.0, board_decay_start=7.0),
    },
    {
        "name": "封单偏好型",
        "desc": "看重封单质量和封板坚决程度，封单强=主力意图明确",
        "weights": {"board_strength": 0.15, "seal_quality": 0.40, "sector_position": 0.15, "theme_freshness": 0.15, "volume_health": 0.15},
        # 封单敏感 → 降低强阈值，更易给高分
        "gene": GeneParams(seal_strong_ratio=0.04),
    },
    {
        "name": "板块龙头型",
        "desc": "侧重板块地位，认为龙头股接力安全性最高",
        "weights": {"board_strength": 0.15, "seal_quality": 0.15, "sector_position": 0.40, "theme_freshness": 0.15, "volume_health": 0.15},
        # 默认基因
        "gene": GeneParams(),
    },
    {
        "name": "题材驱动型",
        "desc": "以题材新鲜度为主，认为主线热点是涨停接力的第一驱动力",
        "weights": {"board_strength": 0.15, "seal_quality": 0.15, "sector_position": 0.15, "theme_freshness": 0.40, "volume_health": 0.15},
        # 题材黄金区间放宽，容忍更高热度
        "gene": GeneParams(theme_golden_high=10.0, theme_overheat=18.0),
    },
    {
        "name": "均衡型",
        "desc": "各维度均衡配置，不偏重单一信号（接近经验默认值）",
        "weights": {"board_strength": 0.25, "seal_quality": 0.20, "sector_position": 0.20, "theme_freshness": 0.20, "volume_health": 0.15},
        # 完全默认基因
        "gene": GeneParams(),
    },
]


def _normalize_weights(w: dict[str, float]) -> dict[str, float]:
    """归一化权重，确保和=1。"""
    total = sum(w.values()) or 1.0
    return {k: round(v / total, 4) for k, v in w.items()}


def _gene_to_dict(gene: GeneParams) -> dict[str, float]:
    """GeneParams → dict（持久化用）。"""
    return {k: float(getattr(gene, k)) for k in GENE_KEYS}


def _gene_from_dict(d: dict) -> GeneParams:
    """dict → GeneParams（加载用，未知字段忽略，clip 保证合法）。"""
    kwargs = {}
    for k in GENE_KEYS:
        if k in d:
            kwargs[k] = float(d[k])
    return clip_gene(GeneParams(**kwargs))


# ====================================================================
# Strategy 个体
# ====================================================================

class Strategy:
    """单个策略：5 维权重 + 参数化基因 + fitness + 风格标签。

    进化搜索空间 = weights（5维） ∪ gene_params（9个打分阈值）。
    评估时用本策略的 gene 重新对样本打分（而不是复用样本里固化的 sub_scores），
    这样基因变异能真正影响 fitness。
    """

    def __init__(
        self,
        weights: dict[str, float],
        gene: GeneParams | None = None,
        style: str = "",
        style_desc: str = "",
        version: str = "",
        parent_ids: list[str] | None = None,
        generation: int = 0,
    ):
        self.weights = _normalize_weights(weights)
        self.gene: GeneParams = clip_gene(gene) if gene is not None else copy.deepcopy(DEFAULT_GENE)
        self.style = style
        self.style_desc = style_desc
        self.version = version or f"gen{generation}-{_short_id()}"
        self.parent_ids = parent_ids or []
        self.generation = generation
        self.fitness: float = 0.0
        self.accuracy: float = 0.0           # is_up_next 准确率
        self.brier: float = 1.0
        # 多目标指标
        self.acc_limit: float = 0.0          # is_limit_up_next 准确率
        self.acc_open: float = 0.0           # is_open_up 准确率
        self.rank_corr: float = 0.0          # 预测概率 vs next_pct 秩相关
        self.samples_tested: int = 0
        self.created_at: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_evaluated: str = ""

    def to_dict(self) -> dict:
        return {
            "weights": self.weights,
            "gene_params": _gene_to_dict(self.gene),
            "style": self.style,
            "style_desc": self.style_desc,
            "version": self.version,
            "parent_ids": self.parent_ids,
            "generation": self.generation,
            "fitness": self.fitness,
            "accuracy": self.accuracy,
            "brier": self.brier,
            "acc_limit": self.acc_limit,
            "acc_open": self.acc_open,
            "rank_corr": self.rank_corr,
            "samples_tested": self.samples_tested,
            "created_at": self.created_at,
            "last_evaluated": self.last_evaluated,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Strategy":
        gene_dict = d.get("gene_params")
        gene = _gene_from_dict(gene_dict) if gene_dict else None
        s = cls(
            weights=d["weights"],
            gene=gene,
            style=d.get("style", ""),
            style_desc=d.get("style_desc", ""),
            version=d.get("version", ""),
            parent_ids=d.get("parent_ids", []),
            generation=d.get("generation", 0),
        )
        s.fitness = d.get("fitness", 0.0)
        s.accuracy = d.get("accuracy", 0.0)
        s.brier = d.get("brier", 1.0)
        s.acc_limit = d.get("acc_limit", 0.0)
        s.acc_open = d.get("acc_open", 0.0)
        s.rank_corr = d.get("rank_corr", 0.0)
        s.samples_tested = d.get("samples_tested", 0)
        s.created_at = d.get("created_at", "")
        s.last_evaluated = d.get("last_evaluated", "")
        return s

    def _rescore_sample(self, s: dict) -> tuple[dict[str, float], float]:
        """用本策略的 gene 重新对单个样本打分，返回 (sub_scores, total)。

        样本里保存了原始 rec 字段（boards/seal_amount/...），用本策略 gene 重新算 4 个
        基因敏感维度的分；sector_position 不依赖基因，复用样本里固化的值（省去重建 records）。
        """
        rec = s.get("rec") or {}
        # 若样本未保存 rec，退回到固化的 sub_scores（旧样本兼容）
        if not rec:
            subs = s.get("sub_scores", s.get("sub_scores_5d", {}))
            total = sum(subs.get(k, 50) * self.weights.get(k, 0.2) for k in WEIGHT_KEYS)
            return subs, total

        boards = int(rec.get("boards", 1))
        seal_amount = float(rec.get("seal_amount", 0))
        float_mv = float(rec.get("float_mv", 50))
        seal_time = str(rec.get("seal_time", "10:00"))
        break_times = int(rec.get("break_times", 0))
        concepts = rec.get("concepts", [])
        theme_stats = s.get("theme_stats") or {}
        turnover = float(rec.get("turnover", 5))
        amount = float(rec.get("amount", 0))
        limit_type = str(rec.get("limit_type", "换手板"))

        # sector_position 不依赖基因，复用样本已算好的值
        cached_subs = s.get("sub_scores", {})
        sector_pos = cached_subs.get("sector_position", 50.0)

        subs = {
            "board_strength":  _score_board_strength(boards, self.gene),
            "seal_quality":    _score_seal_quality(seal_amount, float_mv, seal_time, break_times, self.gene),
            "sector_position": sector_pos,
            "theme_freshness": _score_theme_freshness(concepts, theme_stats, self.gene),
            "volume_health":   _score_volume_health(turnover, amount, limit_type, break_times, self.gene),
        }
        total = sum(subs[k] * self.weights.get(k, 0.2) for k in WEIGHT_KEYS)
        return subs, total

    def evaluate(self, samples: list[dict]) -> tuple[float, float]:
        """在样本集上评估策略，返回 (accuracy, brier)。

        关键：用本策略的 gene 重新打分（而非复用样本固化分），这样基因变异能影响 fitness。
        samples: [{rec: {...}, theme_stats: {...}, sub_scores: {...}, label: bool, labels: {...}}, ...]
        label=True 表示次日确实继续涨停/上涨

        fitness 采用多目标融合：
          - acc_up (is_up_next): 次日上涨准确率，权重 0.4
          - acc_limit (is_limit_up_next): 次日继续涨停准确率，权重 0.3
          - acc_open (is_open_up): 次日红盘开盘准确率，权重 0.2
          - rank_corr: 预测概率与 next_pct 的秩相关，权重 0.1（回归质量）
          - brier: Brier 惩罚（越低越好）
        fitness = 0.4·acc_up + 0.3·acc_limit + 0.2·acc_open + 0.1·(rank_corr+1) − brier
        """
        if not samples:
            return 0.0, 1.0
        correct_up = 0
        correct_limit = 0
        correct_open = 0
        brier_sum = 0.0
        # 收集 (prob, next_pct) 用于秩相关
        prob_pct_pairs: list[tuple[float, float]] = []
        has_labels = any("labels" in s for s in samples)

        for s in samples:
            _, total = self._rescore_sample(s)
            prob = _score_to_prob(total)
            y = 1.0 if s.get("label", False) else 0.0
            if (prob >= 0.5) == (y == 1.0):
                correct_up += 1
            brier_sum += (prob - y) ** 2

            # 多目标：若样本含 labels 字段，分别计算各目标准确率
            labels = s.get("labels") or {}
            if labels:
                is_limit = bool(labels.get("is_limit_up_next", False))
                is_open = bool(labels.get("is_open_up", False))
                next_pct = labels.get("next_pct")
                if (prob >= 0.5) == is_limit:
                    correct_limit += 1
                if (prob >= 0.5) == is_open:
                    correct_open += 1
                if next_pct is not None:
                    prob_pct_pairs.append((prob, float(next_pct)))
            else:
                # 旧样本无 labels，多目标退化为单目标
                correct_limit = correct_up
                correct_open = correct_up

        n = len(samples)
        acc = correct_up / n
        acc_limit = correct_limit / n
        acc_open = correct_open / n
        brier = brier_sum / n

        # 秩相关（Spearman 简化版：用概率与 next_pct 的 Pearson 秩近似）
        rank_corr = _rank_correlation(prob_pct_pairs) if len(prob_pct_pairs) >= 5 else 0.0

        # 多目标 fitness
        if has_labels:
            # rank_corr ∈ [-1, 1]，映射到 [0, 2] 使得中性(0)→1
            self.fitness = round(
                0.4 * acc + 0.3 * acc_limit + 0.2 * acc_open + 0.1 * (rank_corr + 1.0) - brier,
                4,
            )
            self.acc_limit = round(acc_limit, 4)
            self.acc_open = round(acc_open, 4)
            self.rank_corr = round(rank_corr, 4)
        else:
            # 旧样本兼容：用单目标 fitness
            self.fitness = round(acc * 2.0 - brier, 4)
            self.acc_limit = round(acc_limit, 4)
            self.acc_open = round(acc_open, 4)
            self.rank_corr = round(rank_corr, 4)

        self.accuracy = round(acc, 4)
        self.brier = round(brier, 4)
        self.samples_tested = n
        self.last_evaluated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return acc, brier


def _score_to_prob(score: float) -> float:
    """总分 0-100 → 概率 0-1（sigmoid 变换）。"""
    import math
    # 以 55 分为中性点（对应 50% 概率），斜率使得 85 分≈85%
    z = (score - 55) / 10.0
    return round(1.0 / (1.0 + math.exp(-z)), 4)


def _rank_correlation(pairs: list[tuple[float, float]]) -> float:
    """计算 Spearman 秩相关系数（预测概率 vs 次日涨跌幅）。

    返回 [-1, 1]。正值 = 预测概率高的股票次日涨幅也高（排序正确）。
    样本不足时返回 0。
    """
    n = len(pairs)
    if n < 5:
        return 0.0
    # 转为秩
    def _ranks(values: list[float]) -> list[float]:
        sorted_idx = sorted(range(n), key=lambda i: values[i])
        ranks = [0.0] * n
        i = 0
        while i < n:
            j = i
            # 处理并列：相同值取平均秩
            while j + 1 < n and values[sorted_idx[j + 1]] == values[sorted_idx[i]]:
                j += 1
            avg_rank = (i + j) / 2.0 + 1.0  # 秩从 1 开始
            for k in range(i, j + 1):
                ranks[sorted_idx[k]] = avg_rank
            i = j + 1
        return ranks

    probs = [p[0] for p in pairs]
    pcts = [p[1] for p in pairs]
    rank_prob = _ranks(probs)
    rank_pct = _ranks(pcts)

    # Pearson on ranks = Spearman
    mean_p = sum(rank_prob) / n
    mean_c = sum(rank_pct) / n
    cov = sum((rank_prob[i] - mean_p) * (rank_pct[i] - mean_c) for i in range(n))
    var_p = sum((r - mean_p) ** 2 for r in rank_prob)
    var_c = sum((r - mean_c) ** 2 for r in rank_pct)
    denom = (var_p * var_c) ** 0.5
    if denom == 0:
        return 0.0
    return round(cov / denom, 4)


# ====================================================================
# 遗传算子
# ====================================================================

def _short_id() -> str:
    return "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=4))


def _uniform_crossover(parent1: Strategy, parent2: Strategy, generation: int) -> Strategy:
    """均匀交叉：每个权重维度 + 每个基因参数 随机继承父1或父2。"""
    # 权重交叉
    new_weights = {}
    for k in WEIGHT_KEYS:
        w1 = parent1.weights.get(k, 0.2)
        w2 = parent2.weights.get(k, 0.2)
        new_weights[k] = w1 if random.random() < 0.5 else w2
    new_weights = _normalize_weights(new_weights)

    # 基因交叉：每个参数随机继承父1或父2
    new_gene_kwargs = {}
    for k in GENE_KEYS:
        v1 = float(getattr(parent1.gene, k))
        v2 = float(getattr(parent2.gene, k))
        new_gene_kwargs[k] = v1 if random.random() < 0.5 else v2
    new_gene = clip_gene(GeneParams(**new_gene_kwargs))

    return Strategy(
        weights=new_weights,
        gene=new_gene,
        style=f"{parent1.style}×{parent2.style}",
        style_desc=f"交叉策略：{parent1.style} 与 {parent2.style} 的混合体",
        generation=generation,
        parent_ids=[parent1.version, parent2.version],
    )


def _mutate(strategy: Strategy, generation: int, rate: float = 0.15) -> Strategy:
    """高斯变异：以 rate 概率对每个权重维度 + 每个基因参数加小扰动。

    基因参数的扰动幅度按参数量级缩放（避免 board_peak 整数级参数被 0.05 的扰动淹没）。
    """
    # 权重变异
    new_weights = dict(strategy.weights)
    for k in WEIGHT_KEYS:
        if random.random() < rate:
            delta = random.gauss(0, 0.05)
            new_weights[k] = max(0.01, new_weights.get(k, 0.2) + delta)
    new_weights = _normalize_weights(new_weights)

    # 基因变异：每个参数以 rate 概率扰动，扰动幅度 = 参数当前值 × 10%（高斯）
    new_gene_kwargs = {}
    for k in GENE_KEYS:
        v = float(getattr(strategy.gene, k))
        if random.random() < rate:
            # 扰动幅度按量级缩放：大值参数（如 board_peak~5）扰动 0.5，小值参数（如 seal_strong_ratio~0.05）扰动 0.005
            lo, hi = GENE_BOUNDS[k]
            span = hi - lo
            delta = random.gauss(0, span * 0.08)  # 标准差 = 合法区间宽度的 8%
            v = v + delta
        new_gene_kwargs[k] = v
    new_gene = clip_gene(GeneParams(**new_gene_kwargs))

    return Strategy(
        weights=new_weights,
        gene=new_gene,
        style=f"{strategy.style}(变异)",
        style_desc=f"由 {strategy.style} 高斯变异产生",
        generation=generation,
        parent_ids=[strategy.version],
    )


# ====================================================================
# 策略池管理
# ====================================================================

class StrategyPool:
    """5 策略竞争池。"""

    POOL_SIZE = 5
    ELITE_COUNT = 2   # 精英保留数
    BREED_COUNT = 1    # 交叉子代数
    MUTATE_COUNT = 2   # 变异数

    def __init__(self):
        self.strategies: list[Strategy] = []
        self.generation: int = 0
        self.active_id: str = ""
        self.created_at: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.total_evolves: int = 0

    def initialize(self) -> None:
        """初始化池：如果已有存档则加载，否则用 5 种风格创建。"""
        if os.path.exists(POOL_PATH):
            self.load()
        if not self.strategies:
            for style in STRATEGY_STYLES:
                self.strategies.append(Strategy(
                    weights=style["weights"],
                    gene=style.get("gene"),
                    style=style["name"],
                    style_desc=style["desc"],
                    generation=0,
                ))
            self.generation = 0
            self._pick_active()
            self.save()

    def _pick_active(self) -> None:
        """选择当前 fitness 最高的策略作为主策略。"""
        if self.strategies:
            best = max(self.strategies, key=lambda s: s.fitness)
            self.active_id = best.version

    def get_active_strategy(self) -> Strategy:
        """返回当前主策略（fitness 最高）。"""
        if not self.strategies:
            self.initialize()
        return max(self.strategies, key=lambda s: s.fitness)

    def get_active_weights(self) -> dict[str, float]:
        """返回当前主策略的权重向量。"""
        return self.get_active_strategy().weights

    def get_active_gene(self) -> GeneParams:
        """返回当前主策略的基因参数。"""
        return self.get_active_strategy().gene

    def evaluate_all(self, samples: list[dict]) -> None:
        """在样本集上评估所有策略。"""
        for s in self.strategies:
            s.evaluate(samples)

    def evolve(self, samples: list[dict]) -> dict[str, Any]:
        """完整一代进化：评估 → 选择 → 交叉 → 变异 → 淘汰 → 激活。

        返回进化摘要。
        """
        if not self.strategies:
            self.initialize()

        # 1. 评估
        self.evaluate_all(samples)
        self.strategies.sort(key=lambda s: -s.fitness)

        best_before = self.strategies[0]
        old_fitness = [s.fitness for s in self.strategies]

        # 2. 精英保留
        elites = [copy.deepcopy(self.strategies[i]) for i in range(self.ELITE_COUNT)]

        new_gen: list[Strategy] = []

        # 3. 交叉繁殖（精英 Top2）
        if len(elites) >= 2:
            for _ in range(self.BREED_COUNT):
                child = _uniform_crossover(elites[0], elites[1], self.generation + 1)
                child.evaluate(samples)
                new_gen.append(child)

        # 4. 变异（Top3 各产一个变异体）
        to_mutate = self.strategies[:3]
        for parent in to_mutate:
            mutant = _mutate(parent, self.generation + 1)
            mutant.evaluate(samples)
            new_gen.append(mutant)

        # 5. 组装新一代：精英 + 子代，不足从旧池补充
        next_pool = elites + new_gen
        while len(next_pool) < self.POOL_SIZE:
            idx = len(next_pool) % len(self.strategies)
            next_pool.append(copy.deepcopy(self.strategies[idx]))

        self.strategies = next_pool[:self.POOL_SIZE]
        self.generation += 1
        self.total_evolves += 1

        # 6. 选出最佳
        self.strategies.sort(key=lambda s: -s.fitness)
        self._pick_active()

        best_after = self.strategies[0]
        self.save()

        return {
            "generation": self.generation,
            "pool_size": len(self.strategies),
            "best_version": best_after.version,
            "best_style": best_after.style,
            "best_fitness": best_after.fitness,
            "best_accuracy": best_after.accuracy,
            "best_brier": best_after.brier,
            "acc_limit": best_after.acc_limit,
            "acc_open": best_after.acc_open,
            "rank_corr": best_after.rank_corr,
            "best_gene": _gene_to_dict(best_after.gene),
            "improvement": round(best_after.fitness - best_before.fitness, 4),
            "fitness_spread": round(max(old_fitness) - min(old_fitness), 4),
            "new_strategies": [s.version for s in new_gen],
        }

    def save(self) -> None:
        os.makedirs(os.path.dirname(POOL_PATH), exist_ok=True)
        data = {
            "generation": self.generation,
            "active_id": self.active_id,
            "created_at": self.created_at,
            "total_evolves": self.total_evolves,
            "strategies": [s.to_dict() for s in self.strategies],
        }
        with open(POOL_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load(self) -> bool:
        if not os.path.exists(POOL_PATH):
            return False
        with open(POOL_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.strategies = [Strategy.from_dict(d) for d in data.get("strategies", [])]
        self.generation = data.get("generation", 0)
        self.active_id = data.get("active_id", "")
        self.total_evolves = data.get("total_evolves", 0)
        self.created_at = data.get("created_at", "")
        return True

    def summary(self) -> dict[str, Any]:
        if not self.strategies:
            return {"status": "empty"}
        sorted_s = sorted(self.strategies, key=lambda s: -s.fitness)
        return {
            "generation": self.generation,
            "total_evolves": self.total_evolves,
            "active_id": self.active_id,
            "active_style": self.get_active_strategy().style,
            "active_gene": _gene_to_dict(self.get_active_strategy().gene),
            "pool": [
                {
                    "version": s.version,
                    "style": s.style,
                    "style_desc": s.style_desc,
                    "fitness": s.fitness,
                    "accuracy": s.accuracy,
                    "brier": s.brier,
                    "acc_limit": s.acc_limit,
                    "acc_open": s.acc_open,
                    "rank_corr": s.rank_corr,
                    "generation": s.generation,
                    "samples_tested": s.samples_tested,
                    "weights": {k: round(v, 3) for k, v in s.weights.items()},
                    "gene_params": _gene_to_dict(s.gene),
                }
                for s in sorted_s
            ],
        }

    def describe(self) -> str:
        """人类可读摘要。"""
        if not self.strategies:
            return "策略池为空"
        lines = [f"## 策略池 · 第 {self.generation} 代 · {len(self.strategies)} 个策略"]
        for i, s in enumerate(self.strategies):
            marker = " ← 主策略" if s.version == self.active_id else ""
            # 简要展示与默认基因的差异
            gene_diff = _gene_diff_str(s.gene)
            lines.append(
                f"  {i+1}. [{s.style}] {s.version}  fitness={s.fitness:.3f}  "
                f"acc={s.accuracy:.1%}  acc_limit={s.acc_limit:.1%}  acc_open={s.acc_open:.1%}  "
                f"rank_corr={s.rank_corr:+.2f}  brier={s.brier:.3f}{marker}"
            )
            if gene_diff:
                lines.append(f"     gene: {gene_diff}")
        return "\n".join(lines)


def _gene_diff_str(gene: GeneParams) -> str:
    """展示基因与默认值的差异（只列出有变化的参数）。"""
    parts = []
    for k in GENE_KEYS:
        cur = float(getattr(gene, k))
        default = float(getattr(DEFAULT_GENE, k))
        if abs(cur - default) > 1e-6:
            parts.append(f"{k}={cur:.3f}(默认{default:.3f})")
    return ", ".join(parts)


# 全局单实例
_pool: StrategyPool | None = None


def get_pool() -> StrategyPool:
    global _pool
    if _pool is None:
        _pool = StrategyPool()
        _pool.initialize()
    return _pool


def get_active_weights() -> dict[str, float]:
    """快捷函数：获取当前主策略权重。"""
    return get_pool().get_active_weights()


def get_active_gene() -> GeneParams:
    """快捷函数：获取当前主策略的基因参数。"""
    return get_pool().get_active_gene()
