from __future__ import annotations

import os

from arcadia_auth import OidcSettings
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    postgres_user: str = "postgres"
    postgres_password: str = "password"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "portfolio"
    database_url: str | None = None

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_password: str | None = None
    redis_db: int = 0
    redis_url: str | None = None

    # Security - REQUIRED
    secret_key: str = os.getenv("SECRET_KEY") or ""
    session_secret_key: str = os.getenv("SESSION_SECRET_KEY") or ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    refresh_token_expire_minutes: int = 60
    admin_password: str = os.getenv("ADMIN_PASSWORD") or ""

    # Cookie settings
    refresh_cookie_name: str = "refresh_token"
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    cookie_httponly: bool = True
    cookie_samesite: str = "strict"
    cookie_domain: str | None = os.getenv("COOKIE_DOMAIN")

    # CORS (accept str or list[str] for tests)
    cors_origins: str | list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    )

    @field_validator("cors_origins")
    @classmethod
    def _normalize_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, list):
            origins = v
        elif isinstance(v, str):
            origins = [origin.strip() for origin in v.split(",") if origin.strip()]

        # Validate each origin is a valid URL format or *
        validated = []
        for origin in origins:
            origin = origin.strip()
            if not origin:
                continue
            # Allow wildcards
            if origin == "*":
                validated.append(origin)
                continue
            # Basic URL validation
            if origin.startswith(("http://", "https://")):
                # Remove duplicate entries
                if origin not in validated:
                    validated.append(origin)
            else:
                msg = f"Invalid CORS origin '{origin}': must start with http:// or https://"
                raise ValueError(msg)

        return validated

    @property
    def cors_origins_list(self) -> list[str]:
        return list(self.cors_origins) if isinstance(self.cors_origins, list) else []

    # File uploads
    upload_dir: str = os.getenv("UPLOAD_DIR", "uploads")
    compressed_dir: str = os.getenv("COMPRESSED_DIR", "compressed")
    file_upload_dir: str = os.getenv("FILE_UPLOAD_DIR", "file_uploads")
    max_file_size: int = int(
        os.getenv("MAX_FILE_SIZE", str(50 * 1024 * 1024))
    )  # 50MB default
    max_project_images: int = int(os.getenv("MAX_PROJECT_IMAGES", "10"))

    # Image processing
    webp_quality: int = int(os.getenv("WEBP_QUALITY", "85"))
    thumbnail_size: int = int(os.getenv("THUMBNAIL_SIZE", "400"))
    # AVIF tuning
    avif_quality_base_offset: int = int(os.getenv("AVIF_QUALITY_BASE_OFFSET", "-10"))
    avif_quality_floor: int = int(os.getenv("AVIF_QUALITY_FLOOR", "50"))
    avif_effort_default: int = int(os.getenv("AVIF_EFFORT_DEFAULT", "6"))

    # Responsive image sizes
    responsive_sizes: dict = {
        "micro": 200,
        "thumbnail": 400,
        "small": 800,
        "medium": 1200,
        "large": 1600,
        "xlarge": 2400,
    }

    # Quality settings per size
    quality_settings: dict = {
        "micro": 70,
        "thumbnail": 75,
        "small": 80,
        "medium": 85,
        "large": 90,
        "xlarge": 95,
    }

    # Environment detection
    environment: str = os.getenv("ENVIRONMENT", "development")
    rate_limit_enabled: bool | None = None

    # User agent for external API calls
    user_agent: str = os.getenv("USER_AGENT", "photography-portfolio/1.0")

    # External API timeouts (in seconds)
    repository_request_timeout: int = int(os.getenv("REPOSITORY_TIMEOUT", "10"))

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    @property
    def is_development(self) -> bool:
        return self.environment.lower() in ("development", "dev")

    @property
    def is_rate_limit_env_set(self) -> bool:
        return os.getenv("RATE_LIMIT_ENABLED") is not None

    @model_validator(mode="after")
    def _assemble_urls(self) -> Settings:
        if self.rate_limit_enabled is None:
            self.rate_limit_enabled = not self.is_development
        if not self.database_url:
            self.database_url = (
                f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
                f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            )
        if not self.redis_url:
            if self.redis_password:
                self.redis_url = f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
            else:
                self.redis_url = (
                    f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
                )
        return self

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
        extra = "ignore"  # Ignore extra environment variables


# Initialize settings and validate
settings = Settings()
settings.validate_settings()

oidc_settings = OidcSettings()
