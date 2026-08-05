"""数据库与缓存层。

- SQLAlchemy 2.x ORM，默认 SQLite，可无缝切换 PostgreSQL
- 缓存：优先 Redis，未配置时自动降级为进程内 TTL 缓存（保证零依赖可运行）
"""
from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable, Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    future=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --------------------------------------------------------------------------
# 缓存
# --------------------------------------------------------------------------
class _MemoryCache:
    """进程内 TTL 缓存，Redis 不可用时的降级实现。"""

    def __init__(self) -> None:
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            item = self._store.get(key)
            if not item:
                return None
            expire_at, value = item
            if expire_at < time.time():
                self._store.pop(key, None)
                return None
            return value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            self._store[key] = (time.time() + ttl, value)

    def delete_prefix(self, prefix: str) -> int:
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                self._store.pop(k, None)
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()


class CacheClient:
    """统一缓存门面。"""

    def __init__(self) -> None:
        self.backend = "memory"
        self._redis = None
        self._mem = _MemoryCache()
        if settings.REDIS_URL:
            try:
                import redis  # type: ignore

                self._redis = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
                self._redis.ping()
                self.backend = "redis"
            except Exception:
                self._redis = None
                self.backend = "memory"

    def get(self, key: str) -> Optional[Any]:
        if self._redis is not None:
            try:
                raw = self._redis.get(key)
                return json.loads(raw) if raw else None
            except Exception:
                return None
        return self._mem.get(key)

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = ttl or settings.CACHE_TTL
        if self._redis is not None:
            try:
                self._redis.setex(key, ttl, json.dumps(value, ensure_ascii=False, default=str))
                return
            except Exception:
                pass
        self._mem.set(key, value, ttl)

    def clear(self) -> None:
        if self._redis is not None:
            try:
                self._redis.flushdb()
            except Exception:
                pass
        self._mem.clear()

    def cached(self, key: str, producer: Callable[[], Any], ttl: int | None = None) -> Any:
        hit = self.get(key)
        if hit is not None:
            return hit
        value = producer()
        self.set(key, value, ttl)
        return value


cache = CacheClient()


def init_db() -> None:
    from app import models  # noqa: F401  确保模型注册

    Base.metadata.create_all(bind=engine)
