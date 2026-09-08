from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret: str = Field(default="dev-only-change-me", alias="JWT_SECRET")
    access_token_minutes: int = 30
    refresh_token_days: int = 14
    database_url: str = Field(default="sqlite:///./data/auth.db", alias="AUTH_DATABASE_URL")
    cors_origins: str = Field(default="http://localhost:5173", alias="CORS_ORIGINS")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
