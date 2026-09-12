from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration.

    Values can be provided through environment variables
    or a .env file.
    """

    app_name: str = "Fintech Risk Scoring MLOps API"
    app_version: str = "1.0.0"

    environment: str = Field(default="development", description="Application environment")

    model_path: str = Field(
        default="models/fraud_pipeline.joblib", description="Path to trained ML model"
    )

    api_prefix: str = "/api/v1"

    log_level: str = "INFO"

    model_name: str = "fraud-risk-model"

    model_version: str = "1.0.0"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
