from functools import lru_cache
from typing import List
from urllib.parse import quote_plus

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "LMS Portal API"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    API_V1_PREFIX: str = "/api/v1"

    SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30

    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "lms_portal"

    DB_ECHO: bool = False
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_PRE_PING: bool = True

    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:4200"]
    LOG_LEVEL: str = "INFO"
    TRUST_PROXY_HEADERS: bool = False
    ADMIN_EMAIL: str = "admin@lms.local"
    ADMIN_PASSWORD: str = "Admin@12345"
    ADMIN_FIRST_NAME: str = "System"
    ADMIN_LAST_NAME: str = "Administrator"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return (
            f"postgresql+asyncpg://{quote_plus(self.POSTGRES_USER)}:{quote_plus(self.POSTGRES_PASSWORD)}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @model_validator(mode="after")
    def validate_security_defaults(self) -> "Settings":
        if self.is_production and self.SECRET_KEY == "change-me":
            raise ValueError("SECRET_KEY must be changed in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
