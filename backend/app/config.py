"""全局配置。使用 pydantic-settings 从环境变量/`.env` 加载。"""

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Limit-Up Quant AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = True
    APP_SECRET: str = "change-me-in-production-2026"

    DATABASE_URL: str = "sqlite:///./storage/limitup.db"
    REDIS_URL: str = ""           # 留空则自动降级为进程内存缓存
    CACHE_TTL: int = 300

    SOURCE_MODE: Literal["simulator", "akshare", "auto"] = "simulator"
    SIMULATOR_SEED: int = 42
    SIMULATOR_N_STOCKS: int = 720

    ML_MODEL_DIR: str = "./storage/ml_models"
    ML_RETRAIN_THRESHOLD: int = 30   # 累积 N 个新验证样本后自动重训

    # LLM
    LLM_ENABLED: bool = False
    LLM_PROVIDER: str = "openai"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_BASE_URL: str = ""

    # 定时任务
    SCHEDULER_ENABLED: bool = True
    DAILY_COLLECT_TIME: str = "15:10"

    HOST: str = "0.0.0.0"
    PORT: int = 8008

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "allow"


settings = Settings()
