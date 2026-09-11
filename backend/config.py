from __future__ import annotations

import os
from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

# Well-known / demo JWT secrets that must never be accepted in production runs.
INSECURE_JWT_SECRETS = frozenset(
    {
        "",
        "dev-only-change-me",
        "secret",
        "changeme",
        "change-me",
        "jwt-secret",
        "your-secret-here",
    }
)

# Local / non-production environments that may use insecure defaults when opted in via APP_ENV.
_DEV_APP_ENVS = frozenset({"development", "dev", "local", "test"})


def _env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def is_insecure_jwt_secret(secret: str | None) -> bool:
    """Return True if the secret is empty or a well-known demo value."""
    normalized = (secret or "").strip()
    return normalized.lower() in INSECURE_JWT_SECRETS or normalized in INSECURE_JWT_SECRETS


def insecure_defaults_allowed(allow_insecure_defaults: bool, app_env: str) -> bool:
    """Whether insecure JWT defaults may be used via explicit flag or APP_ENV exemption."""
    if allow_insecure_defaults:
        return True
    if (app_env or "").strip().lower() in _DEV_APP_ENVS:
        return True
    return False


def demo_warehouse_allowed(allow_demo_warehouse: bool, app_env: str) -> bool:
    """Whether chat may run against the config.yaml demo warehouse without an activated connection.

    Production default is fail-closed: require an admin-activated warehouse.
    Local exemption: ALLOW_DEMO_WAREHOUSE=true or APP_ENV in development|dev|local|test.
    """
    if allow_demo_warehouse:
        return True
    if (app_env or "").strip().lower() in _DEV_APP_ENVS:
        return True
    return False


class Settings(BaseSettings):
    jwt_secret: str = Field(default="dev-only-change-me", alias="JWT_SECRET")
    llm_settings_secret: str | None = Field(default=None, alias="LLM_SETTINGS_SECRET")
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    database_url: str = Field(default="sqlite:///./data/auth.db", alias="AUTH_DATABASE_URL")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")
    # Local demo only — never enable in production.
    allow_insecure_defaults: bool = Field(default=False, alias="ALLOW_INSECURE_DEFAULTS")
    # Allow chat/Text2SQL against config.yaml demo SQLite when no warehouse is activated.
    # Never enable in production; prefer activating a real connection in the admin UI.
    allow_demo_warehouse: bool = Field(default=False, alias="ALLOW_DEMO_WAREHOUSE")
    # Use APP_ENV=development|dev|local|test to exempt JWT demo secret / demo warehouse without flags.
    app_env: str = Field(default="production", alias="APP_ENV")
    # LangGraph checkpointer: sqlite (default, shared file) or postgres (optional extra).
    checkpointer_backend: str = Field(default="sqlite", alias="CHECKPOINTER_BACKEND")
    checkpointer_sqlite_path: str = Field(default="./data/checkpoints.db", alias="CHECKPOINTER_SQLITE_PATH")
    checkpointer_postgres_url: str | None = Field(default=None, alias="CHECKPOINTER_POSTGRES_URL")
    # Shared cancel ledger for multi-worker 「停止生成」(same filesystem).
    run_cancel_sqlite_path: str = Field(default="./data/run_cancels.db", alias="RUN_CANCEL_SQLITE_PATH")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _reject_insecure_jwt_secret(self) -> Settings:
        if not is_insecure_jwt_secret(self.jwt_secret):
            return self
        if insecure_defaults_allowed(self.allow_insecure_defaults, self.app_env):
            return self
        # pytest sets OPENCHATBI_TEST_MODE in tests/conftest.py so imports can use the demo secret.
        if _env_flag("OPENCHATBI_TEST_MODE"):
            return self
        raise ValueError(
            "Refusing to start with an insecure/default JWT_SECRET. "
            "Set a strong JWT_SECRET for real runs, or for local demo only set "
            "ALLOW_INSECURE_DEFAULTS=true or APP_ENV=development."
        )

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
