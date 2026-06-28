# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    DATABASE_URL: str
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    APP_PUBLIC_URL: str = "http://127.0.0.1:5173"
    MASTER_ADMIN_USERNAME: str | None = None
    MASTER_ADMIN_EMAIL: str | None = None
    MASTER_ADMIN_PASSWORD: str | None = None
    USE_PISTON_CODE_RUNNER: bool = True
    PISTON_EXECUTE_URL: str = "https://emkc.org/api/v2/piston/execute"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings() # type: ignore
