from __future__ import annotations

import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5432/portfolio",
    )

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Security - REQUIRED
    secret_key: str = os.getenv("SECRET_KEY")
    session_secret_key: str = os.getenv("SESSION_SECRET_KEY")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_token_expire_minutes: int = 60
    admin_password: str = os.getenv("ADMIN_PASSWORD")

    # Cookie settings
    refresh_cookie_name: str = "refresh_token"
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    cookie_httponly: bool = True
    cookie_samesite: str = "lax"
    cookie_domain: str | None = os.getenv("COOKIE_DOMAIN")

    # CORS
    cors_origins: str = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # File uploads
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    compressed_dir: str = os.getenv("COMPRESSED_DIR", "compressed")
    max_file_size: int = int(
        os.getenv("MAX_FILE_SIZE", str(50 * 1024 * 1024))
    )  # 50MB default

    # Image processing
    webp_quality: int = int(os.getenv("WEBP_QUALITY", "85"))
    thumbnail_size: int = int(os.getenv("THUMBNAIL_SIZE", "400"))

    # Responsive image sizes
    responsive_sizes: dict = {
        "thumbnail": 400,
        "small": 800,
        "medium": 1200,
        "large": 1600,
        "xlarge": 2400,
    }

    # Quality settings per size
    quality_settings: dict = {
        "thumbnail": 75,
        "small": 80,
        "medium": 85,
        "large": 90,
        "xlarge": 95,
    }

    # Environment detection
    environment: str = os.getenv("ENVIRONMENT", "development")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in ("development", "dev")

    def validate_settings(self) -> None:
        """Validate required settings."""
        errors = []

        # Required environment variables
        if not self.secret_key:
            errors.append("SECRET_KEY environment variable is required")
        elif len(self.secret_key) < 32:
            errors.append("SECRET_KEY must be at least 32 characters long")

        if not self.session_secret_key:
            errors.append("SESSION_SECRET_KEY environment variable is required")
        elif len(self.session_secret_key) < 32:
            errors.append("SESSION_SECRET_KEY must be at least 32 characters long")

        if not self.admin_password:
            errors.append("ADMIN_PASSWORD environment variable is required")
        elif len(self.admin_password) < 8:
            errors.append("ADMIN_PASSWORD must be at least 8 characters long")

        # Production-specific validations
        if self.is_production and not self.cookie_secure:
            errors.append(
                "COOKIE_SECURE must be true in production (set COOKIE_SECURE=true)"
            )

        if errors:
            raise ValueError(
                "Configuration errors:\n" + "\n".join(f"- {error}" for error in errors)
            )

    class Config:
        env_file = ".env"


# Initialize settings and validate
settings = Settings()
settings.validate_settings()
