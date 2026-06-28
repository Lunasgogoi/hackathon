# app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    DATABASE_URL: str
    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    ENABLE_DEV_ROUTES: bool = False
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
    PYTHON_RUNNER_IMAGE: str = "python:3.10-slim"
    JAVASCRIPT_RUNNER_IMAGE: str = "node:18-slim"
    CPP_RUNNER_IMAGE: str = "gcc:12"
    CODE_RUNNER_MEMORY_LIMIT: str = "128m"
    CODE_RUNNER_CPUS: str = "1"
    CODE_RUNNER_PIDS_LIMIT: int = 64
    CODE_RUNNER_TMPFS_SIZE: str = "64m"
    CODE_RUNNER_COMPILE_TIMEOUT_SECONDS: int = 10

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.BACKEND_CORS_ORIGINS.split(",")
            if origin.strip()
        ]

settings = Settings() # type: ignore
