"""Application configuration via environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the Quant Research Platform API."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "QuantVista NIFTY Intelligence"
    app_version: str = "2.0.0"
    debug: bool = False
    api_prefix: str = "/api/v1"

    database_url: str = (
        "postgresql+asyncpg://quant:quant@localhost:5432/quant_research"
    )
    database_url_sync: str = (
        "postgresql://quant:quant@localhost:5432/quant_research"
    )

    data_dir: Path = Path("/data/archive")
    models_dir: Path = Path("/models")

    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost"

    default_train_symbols: str = "RELIANCE,TCS,INFY,HDFCBANK,SBIN"
    optuna_trials: int = 30
    walk_forward_min_train_days: int = 756  # ~3 years
    walk_forward_test_days: int = 126  # ~6 months
    walk_forward_step_days: int = 126

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def default_symbols_list(self) -> list[str]:
        return [s.strip().upper() for s in self.default_train_symbols.split(",") if s.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
