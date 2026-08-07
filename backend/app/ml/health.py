"""模型健康监控 & 进化状态追踪

按「Self-Evolution 1次纠正=永久防御」原则：
  每轮预测验证后自动更新健康指标，偏差超阈自动触发模式标注。

按「OpenClaw 进化 犯错→学习→提炼→强化」闭环：
  health 模块提供实时健康评分、模块状态、异常预警。
"""

import json
import os
import time
from datetime import datetime
from typing import Any

from app.config import settings
from app.ml.scoring import ModelPersistence, get_model

HEALTH_FILE = os.path.join(settings.ML_MODEL_DIR, "health.json")
LEARNINGS_DIR = os.path.abspath(os.path.join(settings.ML_MODEL_DIR, "..", "..", ".learnings"))


def _load_health() -> dict[str, Any]:
    if os.path.exists(HEALTH_FILE):
        with open(HEALTH_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "model_version": "v0",
        "total_predictions": 0,
        "total_verifications": 0,
        "history": [],
        "anomalies": [],
        "evolve_cycles": 0,
        "last_evolve": None,
        "training_samples": 0,
        "pending_samples_since_train": 0,
        "evolution_history": [],
        "last_evolution": {},
    }


def _save_health(h: dict) -> None:
    os.makedirs(os.path.dirname(HEALTH_FILE), exist_ok=True)
    h["updated"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(HEALTH_FILE, "w", encoding="utf-8") as f:
        json.dump(h, f, ensure_ascii=False, indent=2)


def record_verification(accuracy: float, brier: float, sample_count: int, model_version: str) -> dict:
    """每次预测验证后调用，更新健康记录。"""
    h = _load_health()
    h["total_verifications"] += 1
    h["total_predictions"] += sample_count
    h["model_version"] = model_version

    entry = {
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "accuracy": round(accuracy, 4),
        "brier": round(brier, 4),
        "samples": sample_count,
        "model_version": model_version,
    }
    h["history"].append(entry)
    # 只保留最近 60 次
    if len(h["history"]) > 60:
        h["history"] = h["history"][-60:]

    # 异常检测：准确率连续 3 次下降
    recent = [x["accuracy"] for x in h["history"][-6:]]
    if len(recent) >= 4 and all(recent[i] < recent[i - 1] for i in range(1, len(recent))):
        h.setdefault("anomalies", []).append({
            "type": "accuracy_decline",
            "detected": entry["timestamp"],
            "detail": f"连续{len(recent)}次准确率下降: {recent}",
            "status": "active",
        })

    _save_health(h)
    return entry


def record_evolve(model_version: str, train_samples: int, evolution_summary: dict | None = None) -> dict:
    """每次 auto_evolve 重训后调用。

    evolution_summary: 策略池进化摘要（pool.evolve() 返回值），含 generation/best_fitness/
        best_accuracy/acc_limit/acc_open/rank_corr/gene_params 等。若提供则记录多目标指标。
    """
    h = _load_health()
    h["evolve_cycles"] += 1
    h["last_evolve"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    h["training_samples"] = train_samples
    h["pending_samples_since_train"] = 0
    h["model_version"] = model_version

    # 记录策略池进化摘要（多目标指标 + 基因）
    if evolution_summary:
        evo_entry = {
            "timestamp": h["last_evolve"],
            "generation": evolution_summary.get("generation", 0),
            "best_version": evolution_summary.get("best_version", ""),
            "best_style": evolution_summary.get("best_style", ""),
            "best_fitness": evolution_summary.get("best_fitness", 0.0),
            "best_accuracy": evolution_summary.get("best_accuracy", 0.0),
            "acc_limit": evolution_summary.get("acc_limit", 0.0),
            "acc_open": evolution_summary.get("acc_open", 0.0),
            "rank_corr": evolution_summary.get("rank_corr", 0.0),
            "best_brier": evolution_summary.get("best_brier", 0.0),
            "improvement": evolution_summary.get("improvement", 0.0),
        }
        h.setdefault("evolution_history", []).append(evo_entry)
        # 只保留最近 30 代
        if len(h["evolution_history"]) > 30:
            h["evolution_history"] = h["evolution_history"][-30:]
        # 更新最新进化状态
        h["last_evolution"] = evo_entry

    _save_health(h)
    return h


def record_new_samples(count: int) -> None:
    """新增训练样本时调用，不触发重训只计量。"""
    h = _load_health()
    h["pending_samples_since_train"] = h.get("pending_samples_since_train", 0) + count
    _save_health(h)


def record_anomaly(anomaly_type: str, detail: str) -> None:
    """手动标注异常模式。"""
    h = _load_health()
    h.setdefault("anomalies", []).append({
        "type": anomaly_type,
        "detected": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "detail": detail,
        "status": "active",
    })
    _save_health(h)


def resolve_anomaly(anomaly_type: str) -> None:
    """标记异常已解决。"""
    h = _load_health()
    for a in h.get("anomalies", []):
        if a["type"] == anomaly_type and a.get("status") == "active":
            a["status"] = "resolved"
            a["resolved"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    _save_health(h)


def get_model_health() -> dict[str, Any]:
    """返回模型健康仪表板数据。"""
    h = _load_health()
    model = get_model()

    # 计算健康评分 (0-100)
    health_score = 80  # base
    recent_3 = [x["accuracy"] for x in h["history"][-3:]]
    if recent_3:
        avg_acc = sum(recent_3) / len(recent_3)
        health_score += int((avg_acc - 0.5) * 80)  # 50%基准, 100%→+40

    # 数据新鲜度惩罚
    if h["last_evolve"]:
        try:
            last = datetime.strptime(h["last_evolve"], "%Y-%m-%d %H:%M:%S")
            days_stale = (datetime.now() - last).days
            health_score -= min(days_stale * 2, 30)
        except ValueError:
            pass

    # 样本量惩罚
    if h["training_samples"] < 50:
        health_score -= 15
    elif h["training_samples"] < 100:
        health_score -= 5

    # 待处理新样本积压
    pending = h.get("pending_samples_since_train", 0)
    if pending > 50:
        health_score -= 10

    # 活跃异常
    active_anomalies = [a for a in h.get("anomalies", []) if a.get("status") == "active"]
    health_score -= len(active_anomalies) * 5

    health_score = max(0, min(100, health_score))

    # 计算置信度区间（基于历史 Brier）
    brier_values = [x["brier"] for x in h["history"][-10:] if "brier" in x]
    avg_brier = sum(brier_values) / len(brier_values) if brier_values else 0.3
    uncertainty = round((avg_brier**0.5) * 0.8, 3)  # ±σ 约 sqrt(Brier)*0.8

    return {
        "health_score": health_score,
        "health_status": "优秀" if health_score >= 80 else "良好" if health_score >= 60 else "需关注" if health_score >= 40 else "差",
        "model_version": model.version,
        "model_trained_at": model.trained_at,
        "total_verifications": h["total_verifications"],
        "total_predictions": h["total_predictions"],
        "training_samples": h["training_samples"],
        "pending_samples": pending,
        "evolve_cycles": h["evolve_cycles"],
        "last_evolve": h["last_evolve"],
        "recent_accuracy": recent_3[-1] if recent_3 else None,
        "recent_accuracy_3avg": round(sum(recent_3) / len(recent_3), 4) if recent_3 else None,
        "avg_brier": round(avg_brier, 4) if brier_values else None,
        "prediction_uncertainty": uncertainty,
        "active_anomalies": len(active_anomalies),
        "anomalies": active_anomalies[-3:],
        "accuracy_trend": [{"timestamp": x["timestamp"], "accuracy": x["accuracy"]} for x in h["history"][-20:]],
    }


def get_evolution_health() -> dict[str, Any]:
    """返回进化系统健康状态（对齐到策略池进化）。"""
    h = _load_health()
    model = get_model()

    # 统计 .learnings/ 经验
    lrn_count = 0
    lrn_pending = 0
    lrn_file = os.path.join(LEARNINGS_DIR, "LEARNINGS.md")
    err_file = os.path.join(LEARNINGS_DIR, "ERRORS.md")
    if os.path.exists(lrn_file):
        with open(lrn_file, "r", encoding="utf-8") as f:
            content = f.read()
            lrn_count = content.count("## [LRN-")
            lrn_pending = content.count("**Status**: pending")
    err_count = 0
    if os.path.exists(err_file):
        with open(err_file, "r", encoding="utf-8") as f:
            err_count = f.read().count("## [ERR-")

    # 进化阶段（按 evolution-engine 的发育阶段）
    total = h["evolve_cycles"]
    if total >= 50:
        stage = "expert"
        stage_label = "专家阶段 · 概念迁移+规则提案"
    elif total >= 20:
        stage = "mature"
        stage_label = "成熟阶段 · 自动进化(交叉/变异)"
    elif total >= 5:
        stage = "juvenile"
        stage_label = "成长阶段 · 预测+策略建议"
    else:
        stage = "embryonic"
        stage_label = "萌芽阶段 · 基础记录"

    next_stage_at = None
    if stage == "embryonic":
        next_stage_at = 5 - total
    elif stage == "juvenile":
        next_stage_at = 20 - total
    elif stage == "mature":
        next_stage_at = 50 - total

    # 从策略池获取实时状态（对齐到 strategy_pool 进化）
    pool_status = {}
    try:
        from app.ml.strategy_pool import get_pool
        pool = get_pool()
        active = pool.get_active_strategy()
        pool_status = {
            "generation": pool.generation,
            "total_evolves": pool.total_evolves,
            "active_style": active.style,
            "active_fitness": active.fitness,
            "active_accuracy": active.accuracy,
            "active_acc_limit": active.acc_limit,
            "active_acc_open": active.acc_open,
            "active_rank_corr": active.rank_corr,
            "active_brier": active.brier,
        }
    except Exception:
        pass

    # 最近一代进化记录（含多目标指标）
    last_evolution = h.get("last_evolution", {})

    return {
        "evolve_cycles": total,
        "evolution_stage": stage,
        "evolution_stage_label": stage_label,
        "next_stage_in": next_stage_at,
        "last_evolve": h["last_evolve"],
        "model_version": model.version,
        "learnings_count": lrn_count,
        "learnings_pending": lrn_pending,
        "errors_count": err_count,
        "active_anomalies": sum(1 for a in h.get("anomalies", []) if a.get("status") == "active"),
        "training_samples": h["training_samples"],
        "pending_samples": h.get("pending_samples_since_train", 0),
        "retrain_recommended": h.get("pending_samples_since_train", 0) >= 20,
        # 策略池实时状态
        "strategy_pool": pool_status,
        # 最近一代进化的多目标指标
        "last_evolution": last_evolution,
        # 进化历史趋势（最近 10 代）
        "evolution_trend": h.get("evolution_history", [])[-10:],
    }
