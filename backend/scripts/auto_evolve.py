"""AI 进化引擎：预测验证 → 经验沉淀 → 自动重训 闭环

每天盘后运行，自动验证昨日预测、追加训练数据、重训模型（如样本充足）。
与 scripts/calibrate_real.py 不同：本脚本是增量更新，不每次重新拉全部历史。

用法：
    cd backend
    python -m scripts.auto_evolve                    # 默认验证昨日 + 增量重训
    python -m scripts.auto_evolve --date 20260803    # 指定验证日期
    python -m scripts.auto_evolve --full             # 完全重新校准（等同 calibrate_real.py）
    python -m scripts.auto_evolve --deploy           # 重训后自动重建快照 + 部署
"""

import argparse
import json
import os
import sys
import time
from datetime import date, datetime, timedelta

import numpy as np

# noinspection PyUnresolvedReferences
from app.ml.scoring import (
    ModelPersistence,
    ScoreInput,
    calculate_sub_scores,
    compute_grade,
    get_model,
    set_model,
)
from app.data.provider import get_limit_up_data, get_latest_trade_date
from app.config import settings
from app.ml.health import record_verification, record_new_samples, record_evolve, record_anomaly
from app.ml.strategy_pool import get_pool
from app.ml.world_model import get_world, _compute_env_signals

MODEL_PATH = os.path.join(settings.ML_MODEL_DIR, "current_model.pkl")
TRAINING_DATA_PATH = os.path.join(settings.ML_MODEL_DIR, "training_samples.jsonl")


def load_training_data() -> list[dict]:
    """加载已有训练样本。"""
    if not os.path.exists(TRAINING_DATA_PATH):
        return []
    samples = []
    with open(TRAINING_DATA_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                samples.append(json.loads(line))
    return samples


def save_training_data(samples: list[dict]) -> None:
    """追加训练样本（不去重，后续可去重优化）。"""
    os.makedirs(os.path.dirname(TRAINING_DATA_PATH), exist_ok=True)
    with open(TRAINING_DATA_PATH, "a", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")


def verify_predictions(date_str: str) -> dict:
    """验证指定日期的预测：对比昨日预测与今日实际结果，返回新样本。

    Returns:
        {"verified": int, "new_samples": list[dict], "accuracy": float}
    """
    # 获取当天涨停池（作为"预测对象"）
    limits = get_limit_up_data(date_str)
    if not limits:
        print(f"[verify] {date_str} 无涨停数据，跳过")
        return {"verified": 0, "new_samples": [], "accuracy": 0.0}

    # 获取次日涨停池和个股实际涨幅（作为标签）
    next_date = _next_trade_day(date_str)
    next_limits = {r["code"]: r for r in get_limit_up_data(next_date)} if next_date else {}

    new_samples = []
    correct = 0
    total = 0

    for rec in limits:
        code = rec["code"]
        # 计算次日实际上涨
        try:
            actual = _next_day_appreciation(code, date_str)
        except Exception:
            continue
        if actual is None:
            continue

        # 构造特征（复用线上管线）
        from app.data.provider import (
            get_stock_meta,
            get_market_snapshot,
            get_dragon_tiger,
            get_news,
            get_theme_stats,
            get_quotes,
        )
        meta = get_stock_meta(code) or {"float_mv": rec.get("float_mv", 50)}
        snap = get_market_snapshot(date_str)
        dragon = get_dragon_tiger(date_str, code)
        concepts = rec.get("concepts", [])
        news = get_news(date_str, code)
        theme_stats = {t["name"]: t["count"] for t in get_theme_stats(date_str)}
        quotes = get_quotes(code, 60)

        try:
            inp = ScoreInput.from_records(rec, meta, snap, dragon, concepts, news, theme_stats, quotes)
            subs = calculate_sub_scores(inp)
        except Exception:
            continue

        prob = get_model().predict_prob(subs)
        pred_label = prob >= 0.5
        total += 1
        if pred_label == actual:
            correct += 1

        new_samples.append({
            "date": date_str,
            "code": code,
            "sub_scores": {k: round(v, 2) for k, v in subs.items()},
            "label": actual,
            "predicted_prob": prob,
        })

    accuracy = correct / total if total > 0 else 0.0
    print(f"[verify] {date_str} → {total} 只, 准确率 {accuracy:.1%}, 新样本 {len(new_samples)}")
    return {"verified": total, "new_samples": new_samples, "accuracy": accuracy}


def _next_trade_day(date_str: str) -> str | None:
    """获取下一个交易日（简单实现，仅跳过周末）。"""
    from datetime import date as dt
    d = dt(int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8]))
    d += timedelta(days=1)
    while d.weekday() >= 5:  # Saturday=5, Sunday=6
        d += timedelta(days=1)
    # 不超过今天
    if d > dt.today():
        return None
    return d.strftime("%Y%m%d")


def _next_day_appreciation(code: str, date_str: str) -> bool | None:
    """检查个股在指定日期次日是否上涨。

    K线API在当前网络环境中被代理拦截，改用次日涨停池+强势池判断：
    - 出现在次日涨停池 → 继续涨停 → True
    - 出现在次日强势池且涨幅>0 → 强势 → True
    - 都不在 → 未确认 → None（设为弱标签，略悲观）
    """
    from app.data.akshare_adapter import fetch_limit_up_pool, fetch_strong_pool

    next_date = _next_trade_day(date_str)
    if next_date is None:
        return None

    try:
        # 方法1：次日涨停池
        next_limits = fetch_limit_up_pool(next_date)
        if any(r["code"] == code for r in next_limits):
            return True  # 次日继续涨停

        # 方法2：次日强势池
        next_strong = fetch_strong_pool(next_date)
        matched = [r for r in next_strong if r["code"] == code]
        if matched:
            return matched[0].get("change_pct", 0) > 0

        # 都不在 → 弱偏空
        return False
    except Exception:
        return None


def _compute_brier(samples: list[dict]) -> float:
    """计算 Brier 分数：mean((p - y)²)"""
    if not samples:
        return 0.0
    squared = 0.0
    for s in samples:
        y = 1.0 if s["label"] else 0.0
        p = s.get("predicted_prob", 0.5)
        squared += (p - y) ** 2
    return round(squared / len(samples), 4)


def retrain_if_needed(all_samples: list[dict], min_new: int = 20) -> ModelPersistence | None:
    """增量重训：如果新样本数超过阈值，在全部样本上重新训练。

    保持非负约束 + 固定维度（龙虎榜/新闻）不变。
    """
    if len(all_samples) < min_new:
        print(f"[retrain] 总样本 {len(all_samples)} < {min_new}，跳过重训")
        return None

    from sklearn.linear_model import LogisticRegression

    # 固定维度不参与训练
    FIXED = {"龙虎榜评分": 0.05, "新闻评分": 0.02}
    trainable_keys = [k for k in ModelPersistence().weights if k not in FIXED]

    X, y = [], []
    for s in all_samples:
        vec = [s["sub_scores"].get(k, 10.0) for k in trainable_keys]
        X.append(vec)
        y.append(1.0 if s["label"] else 0.0)

    X = np.array(X)
    y = np.array(y)

    if len(set(y)) < 2:
        print("[retrain] 标签单一，无法训练二分类")
        return None

    clf = LogisticRegression(
        penalty="l2", C=1.0, solver="lbfgs", max_iter=5000,
        class_weight="balanced",
    )
    clf.fit(X, y)

    # 生成非负权重
    coef = np.maximum(clf.coef_[0], 0)
    coef_sum = coef.sum()
    if coef_sum > 0:
        coef = coef / coef_sum  # 归一化

    model = ModelPersistence()
    model.version = f"evolved-{datetime.now():%Y%m%d-%H%M}"
    model.trained_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    model.bias = clf.intercept_[0] * 0.1  # 缩小偏置
    for i, k in enumerate(trainable_keys):
        model.weights[k] = round(float(coef[i]), 4)
    for k, v in FIXED.items():
        model.weights[k] = v

    print(f"[retrain] 样本 {len(X)} → model {model.version}")
    print(f"  权重: {json.dumps(model.weights, ensure_ascii=False)}")
    print(f"  偏置: {model.bias:.4f}")

    return model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", help="验证日期 YYYYMMDD（默认最近交易日）")
    ap.add_argument("--full", action="store_true", help="完全重新校准")
    ap.add_argument("--deploy", action="store_true", help="训练后自动重新生成快照并部署")
    args = ap.parse_args()

    if args.full:
        print("=== FULL RECALIBRATION (forward to calibrate_real.py) ===")
        os.system(f"{sys.executable} -m scripts.calibrate_real")
        return

    date_str = args.date or get_latest_trade_date()
    print(f"=== AUTO EVOLVE: {date_str} ===")

    # 1. 验证预测
    verified = verify_predictions(date_str)
    if verified["new_samples"]:
        save_training_data(verified["new_samples"])
        record_new_samples(len(verified["new_samples"]))
    # 记录验证健康
    model = get_model()
    brier = _compute_brier(verified["new_samples"]) if verified["new_samples"] else 0.0
    record_verification(
        accuracy=verified["accuracy"],
        brier=brier,
        sample_count=verified["verified"],
        model_version=model.version,
    )

    # 2. 加载全部样本
    all_samples = load_training_data()
    print(f"[evolve] 累计训练样本: {len(all_samples)}")

    # 3. 增量重训
    model = retrain_if_needed(all_samples)
    if model is not None:
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        model.save(MODEL_PATH)
        set_model(model)
        record_evolve(model.version, len(all_samples))
        print(f"[evolve] 新模型已保存: {model.version}")

        if args.deploy:
            print("[evolve] 重新生成快照...")
            os.system(f"{sys.executable} -m scripts.make_snapshot --limit-detail 80")
            print("[evolve] 部署提示：build frontend + cloudstudio deploy（见 publish.sh）")
    else:
        print("[evolve] 无需重训（样本不足或无改进）")

    # 4. 策略池进化（遗传算法）
    if len(all_samples) >= 30:
        print("[evolve] 策略池竞争进化...")
        pool = get_pool()
        result = pool.evolve(all_samples)
        print(f"  Gen {result['generation']} | best: {result['best_version']} fitness={result['best_fitness']:.3f} acc={result['best_accuracy']:.1%}")
        if result["improvement"] > 0:
            print(f"  ✓ 进化改进: +{result['improvement']:.3f}")
        if result["improvement"] < -0.05:
            record_anomaly("pool_degradation", f"Gen{result['generation']} fitness dropped by {abs(result['improvement']):.3f}")
    else:
        print(f"[evolve] 样本不足 {len(all_samples)}<30，跳过策略池进化")

    # 5. 世界模型感知（市场环境分类）
    wm = get_world()
    signals = _compute_env_signals(
        get_limit_up_data(date_str),
        None,  # snapshot 从 provider 获取，这里简化为 None
    )
    env = wm.next_env(signals)
    wm.record(env, verified["accuracy"], brier, verified["verified"])
    wm.save()
    print(f"[evolve] 市场环境: {env} | 信号: zt={signals.get('zt_count',0)} board_ratio={signals.get('board_ratio',0):.2f} up={signals.get('up_ratio',0):.2f}")

    print("=== AUTO EVOLVE DONE ===")


if __name__ == "__main__":
    main()
