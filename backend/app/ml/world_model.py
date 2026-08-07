"""世界模型：市场环境感知 + 自适应置信度 + 权重微调

按进化引擎「世界模型」柱 + 「因果推理」柱：
  - 跟踪市场状态（涨停家数、连板高度、封板率、跌停数等）
  - 分类为 6 种市场环境
  - 不同环境下微调 5 维评分权重
  - 记录各环境下模型预测准确率
  - 预测时提供环境自适应置信度区间
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

# 各环境的中文描述
ENV_DESCRIPTIONS = {
    "趋势牛市": "市场整体上涨为主，赚钱效应好，适合趋势接力",
    "震荡整理": "涨跌均衡，无明显方向，宜谨慎操作",
    "情绪亢奋": "涨停家数多、连板高度高，市场情绪过热，注意退潮风险",
    "恐慌下跌": "多数个股下跌，市场恐慌情绪蔓延，降低仓位",
    "冰点缩量": "涨停稀少、成交低迷，市场观望情绪重",
    "正常偏强": "市场表现偏强但未过热，适合正常接力操作",
}

# 各环境下 5 维权重的微调系数（乘以基础权重后再归一化）
# 思路：不同环境下各维度的重要性不同
ENV_WEIGHT_ADJUSTMENTS: dict[str, dict[str, float]] = {
    "趋势牛市": {
        # 牛市中连板动能强，连板权重略升
        "board_strength": 1.15, "seal_quality": 0.95, "sector_position": 1.10,
        "theme_freshness": 1.05, "volume_health": 0.90,
    },
    "震荡整理": {
        # 震荡市中封单质量和量价健康更重要
        "board_strength": 0.85, "seal_quality": 1.20, "sector_position": 1.05,
        "theme_freshness": 0.95, "volume_health": 1.15,
    },
    "情绪亢奋": {
        # 亢奋期题材新鲜度最重要（主线热点溢价），连板权重略升
        "board_strength": 1.10, "seal_quality": 0.90, "sector_position": 1.15,
        "theme_freshness": 1.20, "volume_health": 0.80,
    },
    "恐慌下跌": {
        # 恐慌时连板不可靠（容易炸板），封单质量和量价健康更重要
        "board_strength": 0.70, "seal_quality": 1.30, "sector_position": 1.10,
        "theme_freshness": 0.85, "volume_health": 1.25,
    },
    "冰点缩量": {
        # 冰点时量价信号弱，题材和板块地位更重要
        "board_strength": 0.90, "seal_quality": 1.05, "sector_position": 1.15,
        "theme_freshness": 1.10, "volume_health": 0.85,
    },
    "正常偏强": {
        # 正常环境，不做调整
        "board_strength": 1.00, "seal_quality": 1.00, "sector_position": 1.00,
        "theme_freshness": 1.00, "volume_health": 1.00,
    },
}


def _compute_env_signals(limit_up_data: list[dict], snapshot: dict | None) -> dict[str, float]:
    """从涨停数据和市场快照中提取环境信号。"""
    n = len(limit_up_data)
    if n == 0:
        return {"zt_count": 0, "avg_turnover": 0, "board_ratio": 0, "avg_change": 0,
                "max_boards": 0, "limit_down_count": 0, "break_rate": 0}

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
        "max_boards": max(boards) if boards else 0,
        "limit_down_count": snap.get("limit_down_count", 0),
        "break_rate": snap.get("break_rate", 0),
    }


def classify_environment(signals: dict[str, float]) -> str:
    """根据环境信号分类到 6 种市场环境。

    判断依据：涨停数量、连板高度、封板率、跌停数、涨跌比、换手率。
    """
    zt = signals.get("zt_count", 0)
    board = signals.get("board_ratio", 0)
    up = signals.get("up_ratio", 0.5)
    turnover = signals.get("avg_turnover", 5)
    max_boards = signals.get("max_boards", 0)
    limit_down = signals.get("limit_down_count", 0)
    break_rate = signals.get("break_rate", 0)

    # 恐慌下跌：跌停数多 + 涨跌比低
    if up <= 0.30 or limit_down >= 30:
        return "恐慌下跌"

    # 情绪亢奋：涨停多 + 连板占比高 + 最高板高
    if zt >= 50 and (board >= 0.25 or max_boards >= 4):
        return "情绪亢奋"

    # 冰点缩量：涨停少 + 换手低
    if zt <= 15 and turnover <= 2.5:
        return "冰点缩量"

    # 趋势牛市：涨跌比高 + 换手正常
    if up >= 0.60 and turnover >= 3:
        return "趋势牛市"

    # 震荡整理：涨跌均衡 + 波动低
    if 0.40 <= up <= 0.60 and turnover <= 4 and break_rate <= 20:
        return "震荡整理"

    return "正常偏强"


def get_env_weight_adjustment(environment: str) -> dict[str, float]:
    """获取指定环境下的权重微调系数（优先用自适应值，回退到默认）。"""
    # 优先用世界模型里持久化的自适应调整（若已加载）
    adaptive = _get_adaptive_adjustments().get(environment)
    if adaptive:
        return adaptive
    return ENV_WEIGHT_ADJUSTMENTS.get(environment, ENV_WEIGHT_ADJUSTMENTS["正常偏强"])


# 自适应调整缓存（由 WorldModel 加载/保存，全局共享）
_adaptive_adjustments: dict[str, dict[str, float]] | None = None


def _get_adaptive_adjustments() -> dict[str, dict[str, float]]:
    """获取自适应调整缓存（懒加载自世界模型）。"""
    global _adaptive_adjustments
    if _adaptive_adjustments is None:
        wm = get_world()
        _adaptive_adjustments = wm.adaptive_adjustments
    return _adaptive_adjustments


def apply_env_weights(
    base_weights: dict[str, float], environment: str
) -> dict[str, float]:
    """根据市场环境微调基础权重并归一化。

    例如：恐慌下跌时降低连板权重、提高封单权重。
    优先使用世界模型持久化的自适应调整，回退到默认 ENV_WEIGHT_ADJUSTMENTS。
    """
    adj = get_env_weight_adjustment(environment)
    adjusted = {k: base_weights.get(k, 0.2) * adj.get(k, 1.0) for k in base_weights}
    total = sum(adjusted.values()) or 1.0
    return {k: round(v / total, 4) for k, v in adjusted.items()}


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
        # 自适应权重微调：从默认 ENV_WEIGHT_ADJUSTMENTS 拷贝一份，进化时可调整并持久化
        # 默认 ENV_WEIGHT_ADJUSTMENTS 保持只读（作为回退基准）
        self.adaptive_adjustments: dict[str, dict[str, float]] = {
            env: dict(adj) for env, adj in ENV_WEIGHT_ADJUSTMENTS.items()
        }

    def record(self, environment: str, accuracy: float, brier: float, sample_count: int) -> None:
        """记录一次验证结果。"""
        stats = self.env_stats[environment]
        stats["total"] += sample_count
        stats["correct"] += int(accuracy * sample_count)
        stats["brier_sum"] += brier * sample_count
        stats["last_seen"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.last_env = environment
        self.total_observations += 1

    def adapt_weights(self, environment: str, accuracy: float, sample_count: int) -> dict[str, Any]:
        """根据某环境下的准确率自适应调整该环境的权重微调系数。

        策略：
          - 准确率低 (< 0.35) 且样本充足 (≥10)：
            降低当前被放大的维度（adj>1 → 降），提高被抑制的维度（adj<1 → 升），
            每次 ±0.05，clip 到 [0.7, 1.3]。
          - 准确率高 (≥ 0.6) 且样本充足：微幅强化当前方向（±0.02），巩固有效配置。
          - 样本不足：不调整。

        返回调整摘要 {environment, old, new, changed}。
        """
        if sample_count < 10:
            return {"environment": environment, "changed": False, "reason": "samples_insufficient"}

        current = self.adaptive_adjustments.get(environment, dict(ENV_WEIGHT_ADJUSTMENTS.get(environment, {})))
        old = dict(current)

        if accuracy < 0.35:
            # 低准确率：逆转当前偏好（放大的降，抑制的升）
            step = 0.05
            for k, v in current.items():
                if v > 1.0:
                    current[k] = round(max(0.70, v - step), 2)
                elif v < 1.0:
                    current[k] = round(min(1.30, v + step), 2)
            changed = any(old[k] != current[k] for k in current)
        elif accuracy >= 0.60:
            # 高准确率：微幅强化当前方向
            step = 0.02
            for k, v in current.items():
                if v > 1.0:
                    current[k] = round(min(1.30, v + step), 2)
                elif v < 1.0:
                    current[k] = round(max(0.70, v - step), 2)
            changed = any(old[k] != current[k] for k in current)
        else:
            changed = False

        if changed:
            self.adaptive_adjustments[environment] = current
            # 刷新全局缓存
            global _adaptive_adjustments
            _adaptive_adjustments = self.adaptive_adjustments

        return {
            "environment": environment,
            "changed": changed,
            "old": old,
            "new": dict(current),
            "accuracy": round(accuracy, 4),
            "samples": sample_count,
        }

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
                "adaptive_adjustments": self.adaptive_adjustments,
                "updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }, f, ensure_ascii=False, indent=2)
        # 同步刷新全局缓存
        global _adaptive_adjustments
        _adaptive_adjustments = self.adaptive_adjustments

    def load(self) -> bool:
        if not os.path.exists(WM_PATH):
            return False
        with open(WM_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        for env, stats in data.get("env_stats", {}).items():
            self.env_stats[env] = dict(stats)
        self.last_env = data.get("last_env", "正常偏强")
        self.total_observations = data.get("total_observations", 0)
        # 加载持久化的自适应调整（若存在），否则保留默认拷贝
        saved_adj = data.get("adaptive_adjustments")
        if saved_adj and isinstance(saved_adj, dict):
            self.adaptive_adjustments = saved_adj
        global _adaptive_adjustments
        _adaptive_adjustments = self.adaptive_adjustments
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

    def classify_current(
        self, limit_up_data: list[dict], snapshot: dict | None = None
    ) -> dict[str, Any]:
        """判断当前市场环境并返回完整诊断信息。

        返回：环境标签 + 信号指标 + 权重微调建议 + 中文描述。
        """
        signals = _compute_env_signals(limit_up_data, snapshot)
        env = classify_environment(signals)
        self.last_env = env
        self.last_signals = signals

        # 获取权重微调
        weight_adj = get_env_weight_adjustment(env)

        return {
            "environment": env,
            "env_description": ENV_DESCRIPTIONS.get(env, ""),
            "signals": signals,
            "weight_adjustments": weight_adj,
            "confidence_factor": _env_confidence_factor(env),
            "all_envs": [
                {"name": e, "description": ENV_DESCRIPTIONS.get(e, "")}
                for e in ENV_LABELS
            ],
        }


# 全局单实例
_wm: WorldModel | None = None


def get_world() -> WorldModel:
    global _wm
    if _wm is None:
        _wm = WorldModel()
        _wm.load()
    return _wm


def get_world_env(
    limit_up_data: list[dict], snapshot: dict | None = None
) -> dict[str, Any]:
    """快捷函数：判断当前市场环境。"""
    return get_world().classify_current(limit_up_data, snapshot)
