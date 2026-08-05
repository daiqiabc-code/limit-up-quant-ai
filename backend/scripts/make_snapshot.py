"""静态快照生成器 —— 把全部 API 响应固化为 JSON，供公网静态站点使用。

用途：
    后端 FastAPI 无法部署到静态托管（CloudStudio / Pages），
    因此每天收盘后跑一次本脚本，把当日全部 API 响应导出为静态 JSON，
    前端在探测不到 /api/health 时自动降级读取这些文件。

用法：
    cd backend && ./venv/Scripts/python.exe -m scripts.make_snapshot
    可选：--base http://localhost:8008  --limit-detail 60
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime

OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend", "public", "snapshot",
)


def fetch(base: str, path: str, timeout: int = 60):
    url = f"{base}{path}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "snapshot/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        print(f"  ! {path} 失败: {e}")
        return None


def dump(name: str, data, sub: str = "") -> bool:
    if data is None:
        return False
    d = os.path.join(OUT_DIR, sub) if sub else OUT_DIR
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return True


# (输出文件名, API 路径)
ENDPOINTS = [
    ("health.json", "/api/health"),
    ("dashboard.json", "/api/dashboard"),
    ("limitup.json", "/api/limitup"),
    ("ranking.json", "/api/limitup/ranking"),
    ("dates.json", "/api/limitup/dates"),
    ("analysis_industry.json", "/api/analysis/industry"),
    ("analysis_theme.json", "/api/analysis/theme"),
    ("analysis_sentiment.json", "/api/analysis/sentiment"),
    ("analysis_dragon.json", "/api/analysis/dragon"),
    ("learning_stats.json", "/api/learning/stats"),
    ("learning_backtest.json", "/api/learning/backtest"),
    ("learning_logs.json", "/api/learning/logs?limit=30"),
    ("learning_calibration.json", "/api/learning/calibration"),
    ("scanner_potential.json", "/api/scanner/potential?limit=10"),
    ("health_model.json", "/api/health/model"),
    ("health_evolution.json", "/api/health/evolution"),
    ("health_pool.json", "/api/health/pool"),
    ("health_world.json", "/api/health/world"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8008")
    ap.add_argument("--limit-detail", type=int, default=80)
    args = ap.parse_args()

    t0 = time.time()
    print("=" * 62)
    print("Limit-Up Quant AI — 静态快照生成")
    print(f"后端: {args.base}   输出: {OUT_DIR}")
    print("=" * 62)

    if fetch(args.base, "/api/health", timeout=10) is None:
        print("\n后端未运行，无法生成快照。请先启动 uvicorn --port 8008")
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    ok = 0

    print("\n[1/3] 导出主接口...")
    for name, path in ENDPOINTS:
        data = fetch(args.base, path)
        if dump(name, data):
            ok += 1
            print(f"  + {name}")

    # ---- 个股详情 ----
    print(f"\n[2/3] 导出个股详情（最多 {args.limit_detail} 只）...")
    ranking = fetch(args.base, "/api/limitup/ranking")
    codes: list[str] = []
    if ranking and ranking.get("ranking"):
        codes = [r["code"] for r in ranking["ranking"][: args.limit_detail]]
    detail_ok = 0
    for i, code in enumerate(codes, 1):
        d = fetch(args.base, f"/api/detail/{code}", timeout=45)
        if dump(f"{code}.json", d, sub="detail"):
            detail_ok += 1
        if i % 10 == 0 or i == len(codes):
            print(f"  进度 {i}/{len(codes)} (成功 {detail_ok})")

    # ---- 元数据 ----
    print("\n[3/3] 写入元数据...")
    dash = fetch(args.base, "/api/dashboard")
    trade_date = "—"
    collector = "—"
    if dash:
        trade_date = dash.get("snapshot", {}).get("trade_date", "—")
        collector = dash.get("collector", "—")
    meta = {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "trade_date": trade_date,
        "collector": collector,
        "endpoints": ok,
        "details": detail_ok,
        "detail_codes": codes,
        "mode": "static-snapshot",
    }
    dump("meta.json", meta)
    print(f"  + meta.json  (交易日 {trade_date} / 数据源 {collector})")

    size = sum(
        os.path.getsize(os.path.join(dp, f))
        for dp, _, fs in os.walk(OUT_DIR)
        for f in fs
    )
    print("\n" + "=" * 62)
    print(f"完成：{ok} 个接口 + {detail_ok} 只个股详情")
    print(f"总体积 {size/1024:.0f} KB，耗时 {time.time()-t0:.1f}s")
    print("=" * 62)
    return 0


if __name__ == "__main__":
    sys.exit(main())
