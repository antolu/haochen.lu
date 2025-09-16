from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = (
        "postgresql+asyncpg://postgres:password@localhost:5432/photography"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Security
    secret_key: str = "your-secret-key-change-this-in-production"
    session_secret_key: str = "your-session-secret-key-change-this-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_token_expire_minutes: int = 60
    admin_password: str = "admin"

    # Cookie settings
    refresh_cookie_name: str = "refresh_token"
    cookie_secure: bool = False  # Set to True in production with HTTPS
    cookie_httponly: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str | None = None

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # File uploads
    upload_dir: str = "uploads"
    compressed_dir: str = "compressed"
    max_file_size: int = 50 * 1024 * 1024  # 50MB

    # Image processing
    webp_quality: int = 85
    thumbnail_size: int = 400

    class Config:
        env_file = ".env"


settings = Settings()
