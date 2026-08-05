"""世界模型：市场环境感知 + 自适应置信度

按进化引擎「世界模型」柱 + 「因果推理」柱：
  - 跟踪市场状态（波动率、涨停家数、连板占比、涨跌比）
  - 聚类/离散化为 6 种市场环境
  - 记录各环境下模型预测准确率
  - 预测时提供环境自适应置信度区间
  - 反事实推理：如果换到其他环境，预测会怎样变化
"""

import json
import math
import os
from collections import defaultdict
from datetime import datetime
from typing import Any

from app.config import settings

WM_PATH = os.path.join(settings.ML_MODEL_DIR, "world_model.json")

# 6 种市场环境标签
ENV_LABELS = [
    "趋势牛市",    # 多数上涨 + 波动适中
    "震荡整理",    # 涨跌均衡 + 波动低
    "情绪亢奋",    # 涨停占比高 + 连板多
    "恐慌下跌",    # 多数下跌 + 波动高
    "冰点缩量",    # 涨停少 + 成交低迷
    "正常偏强",    # 平衡偏强
]


def _compute_env_signals(limit_up_data: list[dict], snapshot: dict | None) -> dict[str, float]:
    """从涨停数据和市场快照中提取环境信号。"""
    n = len(limit_up_data)
    if n == 0:
        return {"zt_count": 0, "avg_turnover": 0, "board_ratio": 0, "avg_change": 0}

    boards = [r.get("boards", 1) for r in limit_up_data]
    turnovers = [r.get("turnover", 5.0) for r in limit_up_data if r.get("turnover")]
    board_ratio = sum(1 for b in boards if b >= 2) / max(n, 1)

    snap = snapshot or {}
    up_count = snap.get("up_count", n)
    down_count = snap.get("down_count", n)
    up_ratio = up_count / max(up_count + down_count, 1)

    return {
        "zt_count": n,
        "avg_turnover": round(sum(turnovers) / max(len(turnovers), 1), 1) if turnovers else 0,
        "board_ratio": round(board_ratio, 4),
        "up_ratio": round(up_ratio, 4),
        "avg_boards": round(sum(boards) / max(n, 1), 2),
    }


def classify_environment(signals: dict[str, float]) -> str:
    """根据环境信号分类到 6 种市场环境。"""
    zt = signals.get("zt_count", 0)
    board = signals.get("board_ratio", 0)
    up = signals.get("up_ratio", 0.5)
    turnover = signals.get("avg_turnover", 5)

    if up >= 0.65 and turnover >= 3:
        return "趋势牛市"
    if board >= 0.3 and zt >= 30:
        return "情绪亢奋"
    if up <= 0.25:
        return "恐慌下跌"
    if zt <= 15 and turnover <= 2:
        return "冰点缩量"
    if 0.4 <= up <= 0.6 and turnover <= 4:
        return "震荡整理"
    return "正常偏强"


def _env_confidence_factor(environment: str) -> float:
    """环境对置信度的默认影响系数。"""
    boosts = {
        "趋势牛市": 1.05,
        "震荡整理": 0.95,
        "情绪亢奋": 1.10,
        "恐慌下跌": 0.85,
        "冰点缩量": 0.80,
        "正常偏强": 1.00,
    }
    return boosts.get(environment, 1.0)


class WorldModel:
    """市场世界模型：环境 → 预测质量的映射。"""

    def __init__(self):
        self.env_stats: dict[str, dict[str, Any]] = defaultdict(
            lambda: {"total": 0, "correct": 0, "brier_sum": 0.0}
        )
        self.last_env: str = "正常偏强"
        self.last_signals: dict[str, float] = {}
        self.total_observations: int = 0

    def record(self, environment: str, accuracy: float, brier: float, sample_count: int) -> None:
        """记录一次验证结果。"""
        stats = self.env_stats[environment]
        stats["total"] += sample_count
        stats["correct"] += int(accuracy * sample_count)
        stats["brier_sum"] += brier * sample_count
        stats["last_seen"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_env = environment
        self.total_observations += 1

    def accuracy_in(self, environment: str) -> float | None:
        """查询某环境下的历史准确率。"""
        s = self.env_stats.get(environment)
        if not s or s["total"] == 0:
            return None
        return round(s["correct"] / s["total"], 4)

    def brier_in(self, environment: str) -> float | None:
        """查询某环境下的平均 Brier。"""
        s = self.env_stats.get(environment)
        if not s or s["total"] == 0:
            return None
        return round(s["brier_sum"] / s["total"], 4)

    def adaptive_confidence(self, environment: str, base_prob: float, base_uncertainty: float = 0.1) -> dict[str, Any]:
        """环境自适应置信度区间。

        根据环境历史准确率调整置信度宽度：
          - 环境准确率高 → 置信度更窄（更确信）
          - 环境准确率低 → 置信度更宽（更不确定）
          - 环境未见 → 使用默认不确定性
        """
        acc = self.accuracy_in(environment)
        brier = self.brier_in(environment)
        samples = self.env_stats.get(environment, {}).get("total", 0)

        if acc is not None and brier is not None and samples >= 5:
            # 自适应区间宽度
            sigma = math.sqrt(brier) * (1.2 - acc * 0.5)  # 准确率高→窄
            sigma = max(sigma, 0.03)  # 最低不确定度
        else:
            sigma = base_uncertainty
            acc = None

        lower = round(max(0.01, base_prob - 1.5 * sigma), 3)
        upper = round(min(0.99, base_prob + 1.5 * sigma), 3)
        confidence_label = "高" if sigma < 0.08 else "中" if sigma < 0.15 else "低"

        return {
            "environment": environment,
            "env_accuracy": acc,
            "base_prob": base_prob,
            "confidence_range": [lower, upper],
            "uncertainty_sigma": round(sigma, 3),
            "confidence_label": confidence_label,
            "env_samples": samples,
        }

    def counterfactual(self, prob: float, from_env: str) -> dict[str, float]:
        """反事实推理：如果当前环境不同，预测会如何变化。"""
        results = {}
        base_factor = _env_confidence_factor(from_env)
        for env in ENV_LABELS:
            if env == from_env:
                continue
            factor = _env_confidence_factor(env) / base_factor
            results[f"if_{env}"] = round(min(0.99, max(0.01, prob * factor)), 3)
        return results

    def next_env(self, signals: dict[str, float]) -> str:
        """给定环境信号，预测/分类当前环境。"""
        env = classify_environment(signals)
        self.last_signals = signals
        self.last_env = env
        return env

    def save(self) -> None:
        os.makedirs(os.path.dirname(WM_PATH), exist_ok=True)
        with open(WM_PATH, "w", encoding="utf-8") as f:
            json.dump({
                "env_stats": {k: dict(v) for k, v in self.env_stats.items()},
                "last_env": self.last_env,
                "total_observations": self.total_observations,
                "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }, f, ensure_ascii=False, indent=2)

    def load(self) -> bool:
        if not os.path.exists(WM_PATH):
            return False
        with open(WM_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for env, stats in data.get("env_stats", {}).items():
            self.env_stats[env] = dict(stats)
        self.last_env = data.get("last_env", "正常偏强")
        self.total_observations = data.get("total_observations", 0)
        return True

    def summary(self) -> dict[str, Any]:
        summary_data = {}
        for env in ENV_LABELS:
            s = self.env_stats.get(env, {})
            acc = s["correct"] / s["total"] if s.get("total", 0) > 0 else None
            summary_data[env] = {
                "accuracy": round(acc, 4) if acc is not None else None,
                "samples": s.get("total", 0),
                "last_seen": s.get("last_seen", ""),
            }
        return {
            "current_env": self.last_env,
            "total_observations": self.total_observations,
            "environments": summary_data,
        }


# 全局单实例
_wm: WorldModel | None = None


def get_world() -> WorldModel:
    global _wm
    if _wm is None:
        _wm = WorldModel()
        _wm.load()
    return _wm
