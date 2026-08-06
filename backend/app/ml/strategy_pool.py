"""策略池：5 维评分权重的多策略竞争 + 遗传进化。

维护 5 个风格各异的权重向量（对应 5 维盘中评分），通过历史命中率的
fitness 竞争 + 精英保留 + 交叉 + 变异 实现权重的自动优化。

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
from app.ml.scoring import FIVE_DIM_WEIGHTS

POOL_PATH = os.path.join(settings.ML_MODEL_DIR, "strategy_pool.json")

# 5 维权重键（固定，不随模型版本变化）
WEIGHT_KEYS = list(FIVE_DIM_WEIGHTS.keys())


# ====================================================================
# 5 种策略风格定义
# ====================================================================

STRATEGY_STYLES = [
    {
        "name": "连板偏好型",
        "desc": "偏好高连板个股，认为连板动能是接力的核心信号",
        "weights": {"board_strength": 0.40, "seal_quality": 0.15, "sector_position": 0.15, "theme_freshness": 0.15, "volume_health": 0.15},
    },
    {
        "name": "封单偏好型",
        "desc": "看重封单质量和封板坚决程度，封单强=主力意图明确",
        "weights": {"board_strength": 0.15, "seal_quality": 0.40, "sector_position": 0.15, "theme_freshness": 0.15, "volume_health": 0.15},
    },
    {
        "name": "板块龙头型",
        "desc": "侧重板块地位，认为龙头股接力安全性最高",
        "weights": {"board_strength": 0.15, "seal_quality": 0.15, "sector_position": 0.40, "theme_freshness": 0.15, "volume_health": 0.15},
    },
    {
        "name": "题材驱动型",
        "desc": "以题材新鲜度为主，认为主线热点是涨停接力的第一驱动力",
        "weights": {"board_strength": 0.15, "seal_quality": 0.15, "sector_position": 0.15, "theme_freshness": 0.40, "volume_health": 0.15},
    },
    {
        "name": "均衡型",
        "desc": "各维度均衡配置，不偏重单一信号（接近经验默认值）",
        "weights": {"board_strength": 0.25, "seal_quality": 0.20, "sector_position": 0.20, "theme_freshness": 0.20, "volume_health": 0.15},
    },
]


def _normalize_weights(w: dict[str, float]) -> dict[str, float]:
    """归一化权重，确保和=1。"""
    total = sum(w.values()) or 1.0
    return {k: round(v / total, 4) for k, v in w.items()}


# ====================================================================
# Strategy 个体
# ====================================================================

class Strategy:
    """单个策略：5 维权重向量 + fitness + 风格标签。"""

    def __init__(
        self,
        weights: dict[str, float],
        style: str = "",
        style_desc: str = "",
        version: str = "",
        parent_ids: list[str] | None = None,
        generation: int = 0,
    ):
        self.weights = _normalize_weights(weights)
        self.style = style
        self.style_desc = style_desc
        self.version = version or f"gen{generation}-{_short_id()}"
        self.parent_ids = parent_ids or []
        self.generation = generation
        self.fitness: float = 0.0
        self.accuracy: float = 0.0
        self.brier: float = 1.0
        self.samples_tested: int = 0
        self.created_at: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_evaluated: str = ""

    def to_dict(self) -> dict:
        return {
            "weights": self.weights,
            "style": self.style,
            "style_desc": self.style_desc,
            "version": self.version,
            "parent_ids": self.parent_ids,
            "generation": self.generation,
            "fitness": self.fitness,
            "accuracy": self.accuracy,
            "brier": self.brier,
            "samples_tested": self.samples_tested,
            "created_at": self.created_at,
            "last_evaluated": self.last_evaluated,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Strategy":
        s = cls(
            weights=d["weights"],
            style=d.get("style", ""),
            style_desc=d.get("style_desc", ""),
            version=d.get("version", ""),
            parent_ids=d.get("parent_ids", []),
            generation=d.get("generation", 0),
        )
        s.fitness = d.get("fitness", 0.0)
        s.accuracy = d.get("accuracy", 0.0)
        s.brier = d.get("brier", 1.0)
        s.samples_tested = d.get("samples_tested", 0)
        s.created_at = d.get("created_at", "")
        s.last_evaluated = d.get("last_evaluated", "")
        return s

    def evaluate(self, samples: list[dict]) -> tuple[float, float]:
        """在样本集上评估策略，返回 (accuracy, brier)。

        samples: [{sub_scores: {...}, total_score: float, label: bool}, ...]
        label=True 表示次日确实继续涨停/上涨
        """
        if not samples:
            return 0.0, 1.0
        correct = 0
        brier_sum = 0.0
        for s in samples:
            subs = s.get("sub_scores", s.get("sub_scores_5d", {}))
            # 用本策略权重重新计算总分
            total = sum(subs.get(k, 50) * self.weights.get(k, 0.2) for k in WEIGHT_KEYS)
            # 总分 0-100 → 概率 0-1（sigmoid 变换）
            prob = _score_to_prob(total)
            y = 1.0 if s.get("label", False) else 0.0
            if (prob >= 0.5) == (y == 1.0):
                correct += 1
            brier_sum += (prob - y) ** 2
        n = len(samples)
        acc = correct / n
        brier = brier_sum / n
        # fitness = accuracy * 2 - brier（Brier 越低越好，取负）
        self.fitness = round(acc * 2.0 - brier, 4)
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


# ====================================================================
# 遗传算子
# ====================================================================

def _short_id() -> str:
    return "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=4))


def _uniform_crossover(parent1: Strategy, parent2: Strategy, generation: int) -> Strategy:
    """均匀交叉：每个维度随机继承父1或父2的权重。"""
    new_weights = {}
    for k in WEIGHT_KEYS:
        w1 = parent1.weights.get(k, 0.2)
        w2 = parent2.weights.get(k, 0.2)
        new_weights[k] = w1 if random.random() < 0.5 else w2
    new_weights = _normalize_weights(new_weights)
    return Strategy(
        weights=new_weights,
        style=f"{parent1.style}×{parent2.style}",
        style_desc=f"交叉策略：{parent1.style} 与 {parent2.style} 的混合体",
        generation=generation,
        parent_ids=[parent1.version, parent2.version],
    )


def _mutate(strategy: Strategy, generation: int, rate: float = 0.15) -> Strategy:
    """高斯变异：以 rate 概率对每个维度加小扰动，然后归一化。"""
    new_weights = dict(strategy.weights)
    for k in WEIGHT_KEYS:
        if random.random() < rate:
            delta = random.gauss(0, 0.05)
            new_weights[k] = max(0.01, new_weights.get(k, 0.2) + delta)
    new_weights = _normalize_weights(new_weights)
    return Strategy(
        weights=new_weights,
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
            "pool": [
                {
                    "version": s.version,
                    "style": s.style,
                    "style_desc": s.style_desc,
                    "fitness": s.fitness,
                    "accuracy": s.accuracy,
                    "brier": s.brier,
                    "generation": s.generation,
                    "samples_tested": s.samples_tested,
                    "weights": {k: round(v, 3) for k, v in s.weights.items()},
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
            lines.append(
                f"  {i+1}. [{s.style}] {s.version}  fitness={s.fitness:.3f}  acc={s.accuracy:.1%}  brier={s.brier:.3f}{marker}"
            )
        return "\n".join(lines)


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
