from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:3000"
    admin_emails: str = ""  # comma-separated; any user matching is auto-promoted on login/register

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    @field_validator("database_url", mode="after")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        """Force the psycopg3 driver regardless of how the URL is supplied.

        Render exposes Postgres URLs as `postgres://...`, Heroku/older tooling uses
        `postgresql://...`. SQLAlchemy 2 with psycopg3 needs `postgresql+psycopg://...`.
        Normalizing here means the same env var works everywhere.
        """
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://"):]
        if v.startswith("postgresql://") and not v.startswith("postgresql+"):
            return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
