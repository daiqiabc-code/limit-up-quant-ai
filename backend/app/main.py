"""Limit-Up Quant AI — FastAPI 主应用入口。

启动方式：cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8008 --reload
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    from app.data.simulator import get_generated_data
    data = get_generated_data()
    print(f"[Limit-Up Quant AI] 数据就绪，共 {len(data)} 个交易日。")
    print(f"  最新交易日: {data[-1].trade_date if data else '—'}")
    print(f"  收集器: simulator")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from app.routers import analysis, chat, dashboard, detail, learning, limitup, scanner

app.include_router(dashboard.router)
app.include_router(limitup.router)
app.include_router(detail.router)
app.include_router(analysis.router)
app.include_router(learning.router)
app.include_router(chat.router)
app.include_router(scanner.router)


@app.get("/api/health")
def health():
    from app.data.provider import get_collector_type
    return {"status": "ok", "app": settings.APP_NAME, "collector": get_collector_type()}


@app.get("/api/health/model")
def model_health():
    """模型健康仪表板 + 策略池 + 世界模型。"""
    from app.ml.health import get_model_health
    from app.ml.strategy_pool import get_pool
    from app.ml.world_model import get_world
    result = get_model_health()
    result["strategy_pool"] = get_pool().summary()
    result["world_model"] = get_world().summary()
    return result


@app.get("/api/health/evolution")
def evolution_health():
    """进化系统健康状态：阶段/周期/经验数/异常/重训建议。"""
    from app.ml.health import get_evolution_health
    return get_evolution_health()


@app.get("/api/health/pool")
def strategy_pool_status():
    """策略池：多策略竞争状态 + 遗传进化代数。"""
    from app.ml.strategy_pool import get_pool
    return get_pool().summary()


@app.get("/api/health/world")
def world_model_status():
    """世界模型：市场环境分类 + 各环境准确率。"""
    from app.ml.world_model import get_world
    return get_world().summary()
