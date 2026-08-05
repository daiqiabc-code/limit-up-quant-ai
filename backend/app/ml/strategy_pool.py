"""策略池：遗传算法驱动多权重竞争进化

按进化引擎「演化发育」柱：
  - 维护 5-8 个竞争策略（权重向量）
  - 每次验证后评估全池，计算 fitness（准确率 + Brier 惩罚）
  - Top 2 精英交叉（均匀交叉）产生子代
  - Top 3 变异（小扰动）
  - 底层淘汰，保持池大小
  - 每代最优自动设为 active 模型

数据持久化到 storage/ml_models/strategy_pool.json
"""

import copy
import json
import os
import random
from datetime import datetime
from typing import Any, Optional

import numpy as np

from app.config import settings
from app.ml.scoring import ModelPersistence, get_model, set_model

POOL_PATH = os.path.join(settings.ML_MODEL_DIR, "strategy_pool.json")

# 固定不参与进化的维度
FIXED_KEYS = {"龙虎榜评分", "新闻评分"}
FIXED_WEIGHTS = {"龙虎榜评分": 0.05, "新闻评分": 0.02}


def _all_weight_keys() -> list[str]:
    return list(ModelPersistence().weights.keys())


def _trainable_keys() -> list[str]:
    return [k for k in _all_weight_keys() if k not in FIXED_KEYS]


# ====================================================================
# Strategy 个体
# ====================================================================

class Strategy:
    """单个策略：权重向量 + 偏差 + 元信息。"""

    def __init__(
        self,
        weights: dict[str, float],
        bias: float = 0.0,
        version: str = "",
        parent_ids: list[str] | None = None,
        generation: int = 0,
    ):
        self.weights = dict(weights)  # copy
        self.bias = bias
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
            "bias": self.bias,
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
            bias=d.get("bias", 0.0),
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

    def to_model(self) -> ModelPersistence:
        m = ModelPersistence()
        for k in _all_weight_keys():
            m.weights[k] = self.weights.get(k, 0.0)
        m.bias = self.bias
        m.version = self.version
        m.trained_at = self.created_at
        return m

    def evaluate(self, samples: list[dict]) -> tuple[float, float]:
        """在样本集上评估策略，返回 (accuracy, brier)。"""
        if not samples:
            return 0.0, 1.0
        model = self.to_model()
        correct = 0
        brier_sum = 0.0
        for s in samples:
            subs = s.get("sub_scores", {})
            prob = model.predict_prob(subs)
            y = 1.0 if s.get("label", False) else 0.0
            if (prob >= 0.5) == (y == 1.0):
                correct += 1
            brier_sum += (prob - y) ** 2
        n = len(samples)
        acc = correct / n
        brier = brier_sum / n
        # fitness = accuracy * 2 - brier (Brier 越低越好，取负)
        self.fitness = round(acc * 2.0 - brier, 4)
        self.accuracy = round(acc, 4)
        self.brier = round(brier, 4)
        self.samples_tested = n
        self.last_evaluated = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return acc, brier


# ====================================================================
# 遗传算子
# ====================================================================

def _short_id() -> str:
    return "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=4))


def _uniform_crossover(parent1: Strategy, parent2: Strategy, generation: int) -> Strategy:
    """均匀交叉：每个维度随机继承父1或父2的权重。"""
    new_weights = {}
    for k in _trainable_keys():
        w1 = parent1.weights.get(k, 0.0)
        w2 = parent2.weights.get(k, 0.0)
        new_weights[k] = w1 if random.random() < 0.5 else w2
    # 归一化
    total = sum(new_weights.values()) or 1.0
    for k in new_weights:
        new_weights[k] = round(new_weights[k] / total, 4)
    # 固定维度保持不变
    for k in FIXED_KEYS:
        new_weights[k] = FIXED_WEIGHTS[k]
    bias = (parent1.bias + parent2.bias) / 2
    return Strategy(
        weights=new_weights,
        bias=bias,
        generation=generation,
        parent_ids=[parent1.version, parent2.version],
    )


def _mutate(strategy: Strategy, generation: int, rate: float = 0.15) -> Strategy:
    """高斯变异：以 rate 概率对每个维度加小扰动，然后归一化。"""
    new_weights = dict(strategy.weights)
    for k in _trainable_keys():
        if random.random() < rate:
            delta = np.random.normal(0, 0.05)
            new_weights[k] = max(0.001, new_weights[k] + delta)
    total = sum(new_weights[k] for k in _trainable_keys()) or 1.0
    for k in _trainable_keys():
        new_weights[k] = round(new_weights[k] / total * (1 - sum(FIXED_WEIGHTS.values())), 4)
    for k in FIXED_KEYS:
        new_weights[k] = FIXED_WEIGHTS[k]
    bias = strategy.bias + np.random.normal(0, 0.02)
    return Strategy(
        weights=new_weights,
        bias=bias,
        generation=generation,
        parent_ids=[strategy.version],
    )


def _random_strategy(generation: int = 0) -> Strategy:
    """生成随机策略用于初始化池。"""
    keys = _trainable_keys()
    raw = np.abs(np.random.normal(1.0, 0.5, len(keys)))
    raw = raw / raw.sum()
    weights = {k: round(float(raw[i]), 4) for i, k in enumerate(keys)}
    for k in FIXED_KEYS:
        weights[k] = FIXED_WEIGHTS[k]
    return Strategy(weights=weights, bias=0.0, generation=generation)


# ====================================================================
# 策略池管理
# ====================================================================

class StrategyPool:
    """多策略竞争池。"""

    POOL_SIZE = 5
    ELITE_COUNT = 2   # 保留精英数
    BREED_COUNT = 1    # 交叉产生子代数
    MUTATE_COUNT = 2   # 变异数
    MIN_BREED_GEN = 2  # 最少间隔代数才进行繁殖

    def __init__(self):
        self.strategies: list[Strategy] = []
        self.generation: int = 0
        self.active_id: str = ""
        self.created_at: str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.total_evolves: int = 0

    def initialize(self) -> None:
        """初始化池：如果已有存档则加载，否则创建随机池。"""
        if os.path.exists(POOL_PATH):
            self.load()
        if not self.strategies:
            for _ in range(self.POOL_SIZE):
                self.strategies.append(_random_strategy(generation=0))
            self.generation = 0
            # 种子策略：把当前模型加入池
            current = get_model()
            seed = Strategy(
                weights=dict(current.weights),
                bias=current.bias,
                version="seed-" + current.version,
                generation=0,
            )
            self.strategies[0] = seed
            self._pick_active()
            self.save()

    def _pick_active(self) -> None:
        """选择当前 fitness 最高的策略作为 active。"""
        if self.strategies:
            best = max(self.strategies, key=lambda s: s.fitness)
            self.active_id = best.version
            set_model(best.to_model())

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
        if (self.generation + 1) % self.MIN_BREED_GEN == 0 and len(elites) >= 2:
            for _ in range(self.BREED_COUNT):
                child = _uniform_crossover(elites[0], elites[1], self.generation + 1)
                child.evaluate(samples)
                new_gen.append(child)

        # 4. 变异（精英 Top3 各产一个变异体）
        to_mutate = self.strategies[:3]
        for parent in to_mutate:
            mutant = _mutate(parent, self.generation + 1)
            mutant.evaluate(samples)
            new_gen.append(mutant)

        # 5. 组装新一代
        next_pool = elites + new_gen
        # 不足的从旧池最佳中补充
        while len(next_pool) < self.POOL_SIZE:
            candidate = copy.deepcopy(self.strategies[len(next_pool)])
            next_pool.append(candidate)

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
            "pool": [
                {
                    "version": s.version,
                    "fitness": s.fitness,
                    "accuracy": s.accuracy,
                    "brier": s.brier,
                    "generation": s.generation,
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
            marker = "← active" if s.version == self.active_id else ""
            lines.append(
                f"  {i+1}. {s.version} fitness={s.fitness:.3f} acc={s.accuracy:.1%} brier={s.brier:.3f} {marker}"
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
