"""AI 学习系统 —— 预测→验证→进化闭环。

每日流程：
1. 生成预测 → 写入 predictions 表
2. 次日收盘后 → 回填 actual_pct/actual_limit_up 等字段 → verified=True
3. 累积足够新样本 → 自动增量重训 → 更新模型权重
4. 输出学习日志（accuracy/Brier/feature drift）

设计原则：
- 所有预测都落库，无一遗漏
- 验证结果可复现（features 字段存原始特征）
- 模型版本化，可回滚
"""
from __future__ import annotations

import json
import math
import os
from datetime import UTC, datetime
from typing import Any

from app.config import settings
from app.core.db import SessionLocal
from app.ml.scoring import ModelPersistence, get_model, set_model
from app.models import LearningLog, ModelVersion, Prediction


class LearningEngine:
    """AI 学习引擎。"""

    def __init__(self) -> None:
        self.model = get_model()

    def verify_predictions(self, trade_date: str, next_date: str) -> dict[str, Any]:
        """用下一交易日实际数据回填预测结果。

        实际结果来源：模拟器中的次日行情（模拟模式）或真实行情（akshare 模式）。
        """
        from app.data.provider import get_limit_up_data

        db = SessionLocal()
        try:
            # 获取当天预测
            preds = db.query(Prediction).filter(
                Prediction.trade_date == trade_date,
                Prediction.model_version == self.model.version,
            ).all()

            if not preds:
                return {"status": "no_predictions", "count": 0}

            # 获取次日实际涨停数据
            next_limits = get_limit_up_data(next_date)
            next_limit_codes = {r["code"] for r in next_limits}

            # 获取次日行情（逐股查询）
            verified = 0
            hits = 0
            total_brier = 0.0
            actual_ups = 0
            actual_limitups = 0

            for p in preds:
                code = p.code
                # 获取次日 K 线
                from app.data.provider import get_quotes
                quotes = get_quotes(code, 5)
                if not quotes:
                    continue

                # 次日涨幅（取最后一日 vs 涨停日收盘价 ≈ 次日收盘/前日收盘 - 1）
                next_q = quotes[-1]
                prev_close = next_q.get("pre_close", next_q.get("close", 0))
                if prev_close <= 0:
                    continue
                pct = round((next_q["close"] - prev_close) / prev_close * 100, 2)
                open_pct = round((next_q["open"] - prev_close) / prev_close * 100, 2)

                is_limit_up = pct >= 9.5  # 涨跌幅限制内的近似涨停阈值
                is_up = pct > 0
                is_big_up = pct >= 5.0
                is_hit = p.prob_limit_up >= 0.5 and is_limit_up and True or (
                    p.prob_limit_up < 0.5 and not is_limit_up
                )  # 方向正确性

                p.verified = True
                p.actual_pct = pct
                p.actual_open_pct = open_pct
                p.actual_limit_up = is_limit_up
                p.actual_up = is_up
                p.actual_big_up = is_big_up
                p.hit = is_hit
                p.brier = round((p.prob_limit_up - (1.0 if is_limit_up else 0.0)) ** 2, 4)
                p.verified_at = datetime.now(UTC)
                verified += 1

                if is_hit:
                    hits += 1
                if is_limit_up:
                    actual_limitups += 1
                if is_up:
                    actual_ups += 1
                total_brier += p.brier

            db.commit()

            metrics = {
                "total": len(preds),
                "verified": verified,
                "hits": hits,
                "accuracy": round(hits / verified, 4) if verified else 0,
                "actual_limitups": actual_limitups,
                "actual_up_rate": round(actual_ups / verified, 4) if verified else 0,
                "brier": round(total_brier / verified, 4) if verified else 0,
            }
            self._log_event(trade_date, "verify", "验证完成", metrics)
            return {"status": "ok", **metrics}
        finally:
            db.close()

    def compute_precision_at_top(self, trade_date: str, next_date: str, top_n: int = 10) -> dict:
        """计算 Top-N 命中率。"""
        db = SessionLocal()
        try:
            preds = (
                db.query(Prediction)
                .filter(
                    Prediction.trade_date == trade_date,
                    Prediction.model_version == self.model.version,
                    Prediction.verified == True,
                )
                .order_by(Prediction.rank.asc())
                .limit(top_n)
                .all()
            )
            if not preds:
                return {"top_n": top_n, "precision": 0, "count": 0}
            hits = sum(1 for p in preds if p.hit)
            return {
                "top_n": top_n,
                "precision": round(hits / len(preds), 4),
                "count": len(preds),
            }
        finally:
            db.close()

    def check_retrain(self) -> dict:
        """检查是否需要重训"""
        db = SessionLocal()
        try:
            unverified = (
                db.query(Prediction)
                .filter(
                    Prediction.verified == True,
                    Prediction.trade_date
                    > db.query(Prediction)
                    .order_by(Prediction.trade_date.desc())
                    .limit(settings.ML_RETRAIN_THRESHOLD * 2)
                    .offset(settings.ML_RETRAIN_THRESHOLD)
                    .with_entities(Prediction.trade_date)
                    .scalar_subquery(),
                )
                .count()
            )
            need = unverified >= settings.ML_RETRAIN_THRESHOLD
            return {"need_retrain": need, "new_samples": unverified, "threshold": settings.ML_RETRAIN_THRESHOLD}
        finally:
            db.close()

    def retrain(self, trade_date: str) -> dict:
        """增量重训：取已验证的样本微调权重。"""
        db = SessionLocal()
        try:
            verified_preds = (
                db.query(Prediction)
                .filter(Prediction.verified == True)
                .order_by(Prediction.trade_date.desc())
                .limit(500)
                .all()
            )
            if len(verified_preds) < 20:
                return {"status": "insufficient_data", "count": len(verified_preds)}

            # 准备样本
            samples = []
            for p in verified_preds:
                subs = p.sub_scores if isinstance(p.sub_scores, dict) else {}
                if not subs or len(subs) < 5:
                    continue
                samples.append((subs, p.actual_limit_up))

            if not samples:
                return {"status": "no_valid_samples"}

            # 调参
            loss_before = self._compute_brier_on_samples(samples)
            self.model.tune_weights(samples, lr=0.005)
            loss_after = self._compute_brier_on_samples(samples)

            # 版本号
            import datetime as _dt
            ver_num = len(db.query(ModelVersion).all()) + 1
            new_version = f"v{ver_num}"

            # 保存模型
            self.model.version = new_version
            self.model.trained_at = _dt.datetime.now(UTC).isoformat()
            path = os.path.join(settings.ML_MODEL_DIR, f"model_{new_version}.pkl")
            self.model.save(path)
            self.model.save(os.path.join(settings.ML_MODEL_DIR, "current_model.pkl"))

            # 计算新模型准确率
            acc = sum(1 for subs, y in samples if (self.model.predict_prob(subs) >= 0.5) == y) / len(samples)

            # 保存版本记录
            mv = ModelVersion(
                version=new_version,
                algo="linear_ensemble",
                trained_at=_dt.datetime.now(UTC),
                train_samples=len(samples),
                test_samples=len(samples),
                accuracy=round(acc, 4),
                brier=round(loss_after, 4),
                log_loss=round(loss_after, 4),
                weights=self.model.weights,
                is_active=True,
                note=f"增量重训，loss {loss_before:.4f} → {loss_after:.4f}",
            )
            db.add(mv)
            # 旧版本 deactivate
            db.query(ModelVersion).filter(
                ModelVersion.version != new_version,
                ModelVersion.is_active == True,
            ).update({"is_active": False})
            db.commit()

            # 同步全局
            set_model(self.model)

            metrics = {
                "old_version": self.model.version,
                "new_version": new_version,
                "samples": len(samples),
                "loss_before": round(loss_before, 4),
                "loss_after": round(loss_after, 4),
                "accuracy": round(acc, 4),
                "weights": self.model.weights,
            }
            self._log_event(trade_date, "retrain", f"模型进化 {new_version}", metrics)
            return {"status": "ok", **metrics}
        finally:
            db.close()

    def get_learning_stats(self) -> dict:
        """获取学习系统总览。"""
        db = SessionLocal()
        try:
            total_preds = db.query(Prediction).count()
            verified = db.query(Prediction).filter(Prediction.verified == True).count()
            total_hits = db.query(Prediction).filter(Prediction.hit == True).count()
            acc = round(total_hits / verified, 4) if verified else 0

            # Top-10/20 precision over all days
            from sqlalchemy import func, select
            # 简化：取最新一个预测日的数据
            latest_date = (
                db.query(Prediction.trade_date)
                .order_by(Prediction.trade_date.desc())
                .limit(1)
                .scalar()
            )

            top10 = top20 = 0
            if latest_date:
                top10_preds = (
                    db.query(Prediction)
                    .filter(
                        Prediction.trade_date == latest_date,
                        Prediction.verified == True,
                    )
                    .order_by(Prediction.rank.asc())
                    .limit(10)
                    .all()
                )
                top10 = sum(1 for p in top10_preds if p.hit) / max(1, len(top10_preds))
                top20_preds = (
                    db.query(Prediction)
                    .filter(
                        Prediction.trade_date == latest_date,
                        Prediction.verified == True,
                    )
                    .order_by(Prediction.rank.asc())
                    .limit(20)
                    .all()
                )
                top20 = sum(1 for p in top20_preds if p.hit) / max(1, len(top20_preds))

            # 胜率 & 盈亏比（简化）
            avg_return = (
                db.query(Prediction.actual_pct)
                .filter(Prediction.verified == True)
                .all()
            )
            win_rate = sum(1 for (r,) in avg_return if r > 0) / max(1, len(avg_return))
            avg_gain = sum(r for (r,) in avg_return if r > 0) / max(1, sum(1 for (r,) in avg_return if r > 0)) if avg_return else 0
            avg_loss = abs(sum(r for (r,) in avg_return if r <= 0)) / max(1, sum(1 for (r,) in avg_return if r <= 0)) if avg_return else 0
            profit_loss_ratio = avg_gain / max(0.01, avg_loss)

            # 最大回撤（简化：基于验证样本的累计收益）
            returns = [r for (r,) in avg_return]
            cum = 1.0
            peak, max_dd = 1.0, 0.0
            for r in returns:
                cum *= (1 + r / 100)
                peak = max(peak, cum)
                max_dd = max(max_dd, (peak - cum) / peak)

            # 版本历史
            versions = db.query(ModelVersion).order_by(ModelVersion.trained_at.desc()).limit(5).all()

            return {
                "total_predictions": total_preds,
                "verified_count": verified,
                "accuracy": acc,
                "top10_precision": round(top10, 4),
                "top20_precision": round(top20, 4),
                "win_rate": round(win_rate, 4),
                "profit_loss_ratio": round(profit_loss_ratio, 2),
                "max_drawdown": round(max_dd * 100, 1),
                "cumulative_return": round((cum - 1) * 100, 1),
                "active_model": self.model.version,
                "model_versions": [
                    {"version": v.version, "trained_at": str(v.trained_at)[:19],
                     "accuracy": v.accuracy, "brier": v.brier, "samples": v.train_samples}
                    for v in versions
                ],
            }
        finally:
            db.close()

    def run_daily_cycle(self, trade_date: str, next_date: str) -> dict:
        """每日完整学习周期（在定时任务中触发）。"""
        result = {}
        # 1. 验证昨日预测
        result["verify"] = self.verify_predictions(trade_date, next_date)
        # 2. 检查是否需要重训
        check = self.check_retrain()
        result["check"] = check
        if check.get("need_retrain"):
            result["retrain"] = self.retrain(trade_date)
        else:
            result["retrain"] = {"status": "skipped"}
        return result

    # ---------- internal ----------
    def _log_event(self, date_str: str, event: str, summary: str, metrics: dict) -> None:
        db = SessionLocal()
        try:
            log = LearningLog(
                trade_date=date_str,
                event=event,
                summary=summary,
                metrics=metrics,
                created_at=datetime.now(UTC),
            )
            db.add(log)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()

    def _compute_brier_on_samples(self, samples: list[tuple[dict, bool]]) -> float:
        if not samples:
            return 0
        total = 0.0
        for subs, y in samples:
            p = self.model.predict_prob(subs)
            yv = 1.0 if y else 0.0
            total += (p - yv) ** 2
        return total / len(samples)


# 快捷入口
def get_engine() -> LearningEngine:
    return LearningEngine()
