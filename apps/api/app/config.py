from __future__ import annotations

from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py está en: apps/api/app/config.py
# .env está en:      apps/api/.env
API_ROOT = Path(__file__).resolve().parents[1]   # => apps/api
ENV_FILE = API_ROOT / ".env"

class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str = "changeme-super-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if isinstance(value, str) and value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()