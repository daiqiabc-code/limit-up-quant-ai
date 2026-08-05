"""真实历史数据权重校准脚本。

与 calibrate.py（基于模拟器）不同，本脚本使用 AKShare 真实历史涨停池 + 个股日线，
复用线上完全一致的特征管线（app.data.akshare_adapter + app.ml.scoring）生成 10 维分项，
以「次日是否上涨」为标签做逻辑回归，得到贴合真实分布的权重。

特征完全对齐线上：
  - rec 结构 = fetch_limit_up_pool(date) 的输出（boards/turnover/seal_ratio/break_times/...)
  - 行情 = 截至当日的最近 60 根日线（qfq，与 fetch_daily_quotes 一致）
  - 大盘快照 = fetch_market_snapshot(date)
  - 题材统计 = 由当日涨停池 concepts 聚合（与 get_theme_stats 一致）
  - 龙虎榜/新闻：历史无数据，固定为手工权重（不参与学习），避免污染其余维度

标签：次日收益率 > 0（即次日收盘价 > 当日收盘价）。
  说明：若用「次日是否连板」(base rate ~20-30%) 作为标签，校准后概率会整体偏低、
  评级反而更保守；用「次日上涨」(base rate ~50-60%) 既能区分强弱，又能让头部标的达到 S/A。

用法：
  cd backend && ./venv/Scripts/python.exe -m scripts.calibrate_real
"""
from __future__ import annotations

import json
import math
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import akshare as ak
from app.config import settings
from app.data import akshare_adapter as adapter
from app.ml.scoring import (
    ModelPersistence,
    ScoreInput,
    calculate_sub_scores,
    compute_grade,
    _sig,
    get_model,
)

# 可学习的 8 个维度（其余 2 个历史无数据，固定手工权重）
TRAIN_KEYS = [
    "趋势评分", "资金评分", "题材评分", "板块评分",
    "技术评分", "情绪评分", "历史相似度评分", "风险评分",
]
FIXED_WEIGHTS = {"龙虎榜评分": 0.05, "新闻评分": 0.02}

N_DAYS_BACK = 48  # 回看的交易日数量


# ---------------------------------------------------------------------------
# 交易日历
# ---------------------------------------------------------------------------
def get_trade_dates(anchor: str, n: int) -> list[str]:
    """返回 anchor（含）之前的最近 n 个交易日（升序）。"""
    try:
        df = ak.tool_trade_date_hist_sina()
        all_dates = [str(d) for d in df["trade_date"].tolist()]
    except Exception:
        all_dates = []
    if all_dates:
        all_dates = sorted(set(all_dates))
        # 取 <= anchor 的最后 n 个
        prior = [d for d in all_dates if d <= anchor]
        if len(prior) >= n:
            return prior[-n:]
        # 不足则补前面的
        return prior
    # 兜底：手动生成工作日（跳过周末）
    from datetime import datetime, timedelta
    out = []
    d = datetime.strptime(anchor, "%Y-%m-%d")
    while len(out) < n:
        if d.weekday() < 5:  # 0-4 = 周一至周五
            out.append(d.strftime("%Y-%m-%d"))
        d -= timedelta(days=1)
    return list(reversed(out))


# ---------------------------------------------------------------------------
# 行情缓存（按代码缓存完整日线，训练期内重复出现只拉一次）
# ---------------------------------------------------------------------------
_quote_cache: dict[str, list[dict]] = {}


def get_quotes_upto(code: str, trade_date: str, num_bars: int = 60) -> list[dict]:
    if code not in _quote_cache:
        try:
            df = ak.stock_zh_a_hist(symbol=code, period="daily", adjust="qfq")
            if df is None or df.empty:
                _quote_cache[code] = []
            else:
                qs = []
                for _, r in df.iterrows():
                    qs.append({
                        "trade_date": str(r["日期"])[:10],
                        "open": float(r["开盘"]), "high": float(r["最高"]),
                        "low": float(r["最低"]), "close": float(r["收盘"]),
                        "volume": float(r.get("成交量", 0)),
                        "amount": float(r.get("成交额", 0)),
                        "pct_chg": float(r.get("涨跌幅", 0)),
                        "turnover": float(r.get("换手率", 0)),
                    })
                _quote_cache[code] = qs
        except Exception:
            _quote_cache[code] = []
    qs = _quote_cache[code]
    if not qs:
        return []
    upto = [q for q in qs if q["trade_date"] <= trade_date]
    return upto[-num_bars:]


def next_day_return(code: str, trade_date: str) -> float | None:
    """返回 trade_date 下一交易日的收益率（百分比），无数据返回 None。"""
    qs = _quote_cache.get(code)
    if qs is None:
        qs = get_quotes_upto(code, trade_date, num_bars=120)
    if not qs:
        return None
    # 找到 trade_date 的位置
    idx = next((i for i, q in enumerate(qs) if q["trade_date"] == trade_date), None)
    if idx is None or idx + 1 >= len(qs):
        return None
    cur = qs[idx]["close"]
    nxt = qs[idx + 1]["close"]
    if cur <= 0:
        return None
    return (nxt - cur) / cur * 100


# ---------------------------------------------------------------------------
# 构建真实训练样本
# ---------------------------------------------------------------------------
def build_samples() -> tuple[list[dict], list[str], list[str]]:
    anchor = "2026-08-03"
    dates = get_trade_dates(anchor, N_DAYS_BACK + 1)  # 多取一天用于标签
    print(f"交易日历：{len(dates)} 天（{dates[0]} ~ {dates[-1]}）")

    samples = []
    for i, d in enumerate(dates):
        if i == len(dates) - 1:
            break  # 最后一天无次日标签
        next_d = dates[i + 1]
        pool = adapter.fetch_limit_up_pool(d)
        if not pool:
            continue
        snap = adapter.fetch_market_snapshot(d) or {}
        # 题材统计：由当日涨停池 concepts 聚合
        theme_counts: dict[str, int] = {}
        for r in pool:
            for c in r.get("concepts", []):
                theme_counts[c] = theme_counts.get(c, 0) + 1

        # 次日涨停池（辅助指标：次日是否连板）
        try:
            next_pool = adapter.fetch_limit_up_pool(next_d)
            next_limit_codes = {r["code"] for r in next_pool}
        except Exception:
            next_limit_codes = set()

        day_count = 0
        for rec in pool:
            code = rec["code"]
            quotes = get_quotes_upto(code, d)
            if not quotes:
                continue
            ret = next_day_return(code, d)
            if ret is None:
                continue
            # float_mv 直接取自涨停池 rec（与 live 从 stock_individual_info_em 取的值一致），
            # 避免对每只票重复请求 akshare，节省上千次网络调用
            meta = {"float_mv": rec.get("float_mv", 50)}
            concepts = rec.get("concepts", [])
            inp = ScoreInput.from_records(
                rec, meta, snap, [], concepts, [], theme_counts, quotes,
            )
            subs = calculate_sub_scores(inp)
            # 主标签：次日上涨；次标签：次日连板
            samples.append({
                "code": code, "trade_date": d, "next_date": next_d,
                "sub_scores": subs,
                "up_next_day": ret > 0,
                "limit_next_day": code in next_limit_codes,
                "ret_next_day": round(ret, 2),
                "boards": rec.get("boards", 1),
            })
            day_count += 1
        print(f"  {d}: 样本 +{day_count}（累计 {len(samples)}）")
    return samples, dates[:-1], [dates[-1]]


# ---------------------------------------------------------------------------
# 逻辑回归（非负约束 + 偏置）
# ---------------------------------------------------------------------------
def logistic_regression(samples, lr=0.01, epochs=300, nonneg=True):
    keys = TRAIN_KEYS
    w = {k: 0.0 for k in keys}
    b = 0.0
    X, Y = [], []
    for s in samples:
        subs = s["sub_scores"]
        feat = [(subs.get(k, 10) / 20 - 0.5) * 6 for k in keys]
        X.append(feat)
        Y.append(1.0 if s["up_next_day"] else 0.0)
    n = len(X)
    if n < 30:
        return w, b
    best_brier = float("inf")
    best = (dict(w), b)
    for _ in range(epochs):
        dw = {k: 0.0 for k in keys}
        db = 0.0
        total = 0.0
        for i in range(n):
            z = b + sum(w[keys[j]] * X[i][j] for j in range(len(keys)))
            p = _sig(z)
            err = p - Y[i]
            total += (p - Y[i]) ** 2
            for j, k in enumerate(keys):
                dw[k] += err * X[i][j]
            db += err
        brier = total / n
        if brier < best_brier - 1e-5:
            best_brier = brier
            best = ({k: w[k] for k in keys}, b)
        for k in keys:
            w[k] -= lr * dw[k] / n
        b -= lr * db / n
        if nonneg:
            for k in keys:
                if w[k] < 0:
                    w[k] = 0.0
    return best


def evaluate(samples, weights, bias):
    keys = list(weights.keys())
    tp = fp = tn = fn = 0
    brier = 0.0
    probs = []
    ys = []
    for s in samples:
        subs = s["sub_scores"]
        z = bias + sum(weights.get(k, 0) * ((subs.get(k, 10) / 20 - 0.5) * 6) for k in keys)
        p = _sig(z)
        y = 1.0 if s["up_next_day"] else 0.0
        brier += (p - y) ** 2
        probs.append(p)
        ys.append(y)
        pred = p >= 0.5
        if pred and y > 0.5:
            tp += 1
        elif pred and y < 0.5:
            fp += 1
        elif not pred and y > 0.5:
            fn += 1
        else:
            tn += 1
    n = len(samples)
    # 评级分布
    grades = {}
    for p in probs:
        g = compute_grade(p)
        grades[g] = grades.get(g, 0) + 1
    acc = (tp + tn) / n if n else 0
    prec = tp / (tp + fp) if (tp + fp) else 0
    rec = tp / (tp + fn) if (tp + fn) else 0
    return {
        "n": n, "accuracy": round(acc, 4), "precision": round(prec, 4),
        "recall": round(rec, 4), "brier": round(brier / n, 4),
        "grade_dist": grades,
    }


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def run():
    t0 = time.time()
    print("=" * 64)
    print("Limit-Up Quant AI — 真实历史数据权重校准")
    print("=" * 64)

    print("\n[1/5] 构建真实训练样本...")
    samples, train_dates, last_date = build_samples()
    if not samples:
        print("✗ 未获取到任何样本，请检查网络 / AKShare。")
        return None
    print(f"  共 {len(samples)} 个样本，覆盖 {len(train_dates)} 个交易日")

    # 按时间切分训练/测试（最后 20% 交易日作测试，避免未来信息泄露）
    all_d = sorted(set(s["trade_date"] for s in samples))
    split = int(len(all_d) * 0.8)
    train_dates_set = set(all_d[:split])
    test_dates_set = set(all_d[split:])
    train = [s for s in samples if s["trade_date"] in train_dates_set]
    test = [s for s in samples if s["trade_date"] in test_dates_set]
    print(f"  训练 {len(train)}（{len(train_dates_set)}天）| 测试 {len(test)}（{len(test_dates_set)}天）")

    print("\n[2/5] 评估旧模型（当前线上权重）...")
    old = get_model()
    old_full = dict(old.weights)
    old_bias = old.bias
    old_metrics = evaluate(test, old_full, old_bias)
    print(f"  Brier={old_metrics['brier']} Acc={old_metrics['accuracy']} 分布={old_metrics['grade_dist']}")

    print("\n[3/5] 逻辑回归训练（8 维可学习 + 偏置，非负约束）...")
    lw, lb = logistic_regression(train, lr=0.01, epochs=400, nonneg=True)
    new_trainable = dict(lw)
    # 重新归一化：可学习 8 维之和 = 1 - 固定维度之和
    fixed_sum = sum(FIXED_WEIGHTS.values())
    target = 1.0 - fixed_sum
    s = sum(new_trainable.values())
    if s > 0:
        for k in new_trainable:
            new_trainable[k] = round(new_trainable[k] / s * target, 4)
    full_weights = {**new_trainable, **FIXED_WEIGHTS}
    new_metrics = evaluate(test, full_weights, lb)
    print(f"  训练后 Brier={new_metrics['brier']} Acc={new_metrics['accuracy']} 分布={new_metrics['grade_dist']}")

    print("\n[4/5] 保存模型...")
    m = ModelPersistence()
    m.weights = full_weights
    m.bias = round(lb, 4)
    m.version = "v2-real"
    m.trained_at = time.strftime("%Y-%m-%d %H:%M:%S")
    out_dir = settings.ML_MODEL_DIR
    os.makedirs(out_dir, exist_ok=True)
    m.save(os.path.join(out_dir, "current_model.pkl"))

    report = {
        "version": "v2-real",
        "samples": len(samples), "train_days": len(train_dates_set),
        "test_days": len(test_dates_set),
        "trained_at": m.trained_at,
        "old_weights": old_full, "new_weights": full_weights, "bias": m.bias,
        "old_metrics": old_metrics, "new_metrics": new_metrics,
        "trainable_raw": {k: round(v, 4) for k, v in lw.items()},
    }
    with open(os.path.join(out_dir, "calibrated_weights_real.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # 报告文本
    lines = [
        "# 真实数据权重校准报告 (v2-real)",
        "",
        f"- 样本：{len(samples)} 个（{len(train_dates_set)} 训练日 / {len(test_dates_set)} 测试日）",
        f"- 标签：次日上涨（base rate ≈ {sum(1 for s in samples if s['up_next_day'])/len(samples):.0%}）",
        f"- 训练耗时：{time.time()-t0:.1f}s",
        "",
        "## 权重对比",
        "",
        "| 维度 | 旧(线上) | 新(真实) |",
        "|------|----------|----------|",
    ]
    for k in old_full:
        ov = old_full.get(k, 0)
        nv = full_weights.get(k, 0)
        flag = " ◀" if abs(ov - nv) > 0.02 else ""
        lines.append(f"| {k} | {ov:.3f} | {nv:.3f}{flag} |")
    lines += [
        "",
        "## 指标对比（测试集）",
        "",
        "| 指标 | 旧 | 新 |",
        "|------|----|----|",
        f"| Brier↓ | {old_metrics['brier']} | {new_metrics['brier']} |",
        f"| 准确率 | {old_metrics['accuracy']} | {new_metrics['accuracy']} |",
        f"| 精确率 | {old_metrics['precision']} | {new_metrics['precision']} |",
        f"| 召回率 | {old_metrics['recall']} | {new_metrics['recall']} |",
        "",
        "## 评级分布（测试集）",
        "",
        f"- 旧：{old_metrics['grade_dist']}",
        f"- 新：{new_metrics['grade_dist']}",
        "",
        "> 非负约束 + 偏置训练；龙虎榜/新闻维度历史无数据，固定为手工权重。",
    ]
    with open(os.path.join(out_dir, "calibration_report_real.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("\n[5/5] 完成。")
    print(f"  权重文件：{os.path.join(out_dir, 'current_model.pkl')}")
    print(f"  报告：{os.path.join(out_dir, 'calibration_report_real.md')}")
    print("\n" + "\n".join(lines))
    return report


if __name__ == "__main__":
    run()
