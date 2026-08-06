"""静态快照生成器 —— 直接调用数据层，无需启动后端 HTTP 服务。

用法：
    cd backend && python -m scripts.make_snapshot

环境变量：
    SOURCE_MODE=akshare    # 强制使用真实行情（失败返回空，不降级）
    SOURCE_MODE=simulator   # 强制使用模拟器
    SOURCE_MODE=auto        # 优先真实，失败降级模拟器（默认）

输出：
    frontend/public/snapshot/limitup.json
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime

# 确保能找到 app 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ---- 读取 SOURCE_MODE 环境变量，在导入 app 之前生效 ----
_source_mode = os.environ.get("SOURCE_MODE", "auto")
os.environ.setdefault("SOURCE_MODE", _source_mode)

from app.config import settings  # noqa: E402
# 运行时覆盖配置（环境变量优先级高于 .env）
settings.SOURCE_MODE = _source_mode  # type: ignore

from app.data.provider import (  # noqa: E402
    get_latest_trade_date,
    get_limit_up_data,
    get_previous_limit_up,
    get_collector_type,
)

# 输出目录
OUT_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "frontend", "public", "snapshot",
)


def _write_json(name: str, data) -> str:
    path = os.path.join(OUT_DIR, name)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def _simplify_record(rec: dict) -> dict:
    """精简为用户指定的 limitup.json 字段结构。"""
    code = str(rec.get("code", ""))
    return {
        "code": code,
        "name": str(rec.get("name", "")),
        "price": round(float(rec.get("close", 0)), 2),
        "limit_price": round(float(rec.get("close", 0)) / (1 + float(rec.get("pct_chg", 10)) / 100), 2),
        "fb_count": int(rec.get("boards", 1)),          # 连板数
        "fd_amount": round(float(rec.get("seal_amount", 0)) / 1e4, 0),  # 封单额（万元）
        "reason": str(rec.get("reason", "")),
        "industry": str(rec.get("industry", "")),
    }


def main() -> int:
    t0 = time.time()
    print("=" * 62)
    print("Limit-Up Quant AI — 涨停快照生成")
    print(f"  SOURCE_MODE = {settings.SOURCE_MODE}")
    print(f"  输出目录     = {OUT_DIR}")
    print("=" * 62)

    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. 获取最近交易日
    trade_date = get_latest_trade_date()
    collector = get_collector_type()
    print(f"\n[1/3] 交易日: {trade_date}  数据源: {collector}")

    # 2. 抓取涨停数据
    print("\n[2/3] 抓取涨停池...")
    records = get_limit_up_data(trade_date)
    if not records:
        print("  ⚠ 涨停池为空（可能是非交易日或网络不可用）")
        if settings.SOURCE_MODE == "auto":
            print("  → auto 模式: 降级为模拟器数据")
            # provider 内部已处理降级，这里再次检查
            records = get_limit_up_data(trade_date)

    print(f"  获取 {len(records)} 条涨停记录")

    # 3. 生成 limitup.json
    simplified = [_simplify_record(r) for r in records]
    snapshot = {
        "trade_date": trade_date,
        "source": collector,
        "count": len(simplified),
        "records": simplified,
    }
    path = _write_json("limitup.json", snapshot)
    print(f"\n[3/3] 写入 limitup.json ({os.path.getsize(path):,} bytes)")
    print(f"  样例: {json.dumps(simplified[0], ensure_ascii=False) if simplified else '(空)'}")

    # 附加：昨日涨停今日表现（仅 akshare 模式）
    if settings.SOURCE_MODE in ("akshare", "auto"):
        print("\n[附加] 抓取昨日涨停今日表现...")
        prev = get_previous_limit_up(trade_date)
        if prev:
            prev_path = _write_json("limitup_previous.json", {
                "trade_date": trade_date,
                "source": "akshare",
                "count": len(prev),
                "records": prev,
            })
            print(f"  ✓ limitup_previous.json ({len(prev)} 条)")
        else:
            print("  - 昨日涨停数据不可用（非交易日或网络问题）")

    # 元数据
    _write_json("meta.json", {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "trade_date": trade_date,
        "collector": collector,
        "source_mode": settings.SOURCE_MODE,
        "endpoints": 1,
        "details": 0,
        "detail_codes": [],
        "mode": "static-snapshot",
    })
    print(f"\n  ✓ meta.json")

    elapsed = time.time() - t0
    print("\n" + "=" * 62)
    print(f"完成：{len(simplified)} 条涨停记录，数据源 {collector}，耗时 {elapsed:.1f}s")
    print(f"输出：{OUT_DIR}")
    print("=" * 62)
    return 0


if __name__ == "__main__":
    sys.exit(main())
