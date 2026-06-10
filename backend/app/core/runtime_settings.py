from __future__ import annotations

import logging
import typing
from dataclasses import dataclass, field

import sqlalchemy
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings as static_settings
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class SystemConfigService:
    """Runtime-editable image and system settings.

    Defaults are sourced from static env-based settings but can be overridden at runtime.
    """

    responsive_sizes: dict[str, int] = field(
        default_factory=lambda: dict(static_settings.responsive_sizes)
    )
    quality_settings: dict[str, int] = field(
        default_factory=lambda: dict(static_settings.quality_settings)
    )

    avif_quality_base_offset: int = static_settings.avif_quality_base_offset
    avif_quality_floor: int = static_settings.avif_quality_floor
    avif_effort_default: int = static_settings.avif_effort_default

    webp_quality: int = static_settings.webp_quality
    _rate_limit_enabled: bool = field(default=True)

    # Rate Limiting Settings
    rate_limit_calls: int = 100
    rate_limit_period: int = 3600
    rate_limit_file_calls: int = 20
    rate_limit_file_period: int = 60
    rate_limit_auth_calls: int = 60
    rate_limit_auth_period: int = 60

    @property
    def rate_limit_enabled(self) -> bool:
        if static_settings.is_rate_limit_env_set:
            return bool(static_settings.rate_limit_enabled)
        return self._rate_limit_enabled

    @rate_limit_enabled.setter
    def rate_limit_enabled(self, value: bool) -> None:
        self._rate_limit_enabled = value

    def apply(self, data: dict[str, typing.Any] | None) -> None:
        if not data:
            return
        if "responsive_sizes" in data and isinstance(data["responsive_sizes"], dict):
            self.responsive_sizes = {
                str(k): int(v) for k, v in data["responsive_sizes"].items()
            }
        if "quality_settings" in data and isinstance(data["quality_settings"], dict):
            self.quality_settings = {
                str(k): int(v) for k, v in data["quality_settings"].items()
            }
        if "avif_quality_base_offset" in data:
            self.avif_quality_base_offset = int(data["avif_quality_base_offset"])
        if "avif_quality_floor" in data:
            self.avif_quality_floor = int(data["avif_quality_floor"])
        if "avif_effort_default" in data:
            self.avif_effort_default = int(data["avif_effort_default"])
        if "webp_quality" in data:
            self.webp_quality = int(data["webp_quality"])
        if "rate_limit_enabled" in data:
            self.rate_limit_enabled = bool(data["rate_limit_enabled"])
        if "rate_limit_calls" in data:
            self.rate_limit_calls = int(data["rate_limit_calls"])
        if "rate_limit_period" in data:
            self.rate_limit_period = int(data["rate_limit_period"])
        if "rate_limit_file_calls" in data:
            self.rate_limit_file_calls = int(data["rate_limit_file_calls"])
        if "rate_limit_file_period" in data:
            self.rate_limit_file_period = int(data["rate_limit_file_period"])
        if "rate_limit_auth_calls" in data:
            self.rate_limit_auth_calls = int(data["rate_limit_auth_calls"])
        if "rate_limit_auth_period" in data:
            self.rate_limit_auth_period = int(data["rate_limit_auth_period"])

    async def _fetch_or_create_db_settings(
        self, session: AsyncSession
    ) -> SystemSetting:
        result = await session.execute(
            sqlalchemy.select(SystemSetting).where(SystemSetting.id == 1)
        )
        db_settings = result.scalar_one_or_none()
        if db_settings:
            return db_settings

        db_settings = SystemSetting(
            id=1,
            responsive_sizes=self.responsive_sizes,
            quality_settings=self.quality_settings,
            avif_quality_base_offset=self.avif_quality_base_offset,
            avif_quality_floor=self.avif_quality_floor,
            avif_effort_default=self.avif_effort_default,
            webp_quality=self.webp_quality,
            rate_limit_enabled=self.rate_limit_enabled,
            rate_limit_calls=self.rate_limit_calls,
            rate_limit_period=self.rate_limit_period,
            rate_limit_file_calls=self.rate_limit_file_calls,
            rate_limit_file_period=self.rate_limit_file_period,
            rate_limit_auth_calls=self.rate_limit_auth_calls,
            rate_limit_auth_period=self.rate_limit_auth_period,
        )
        session.add(db_settings)
        await session.commit()
        await session.refresh(db_settings)
        return db_settings

    def _apply_db_settings(self, db_settings: SystemSetting) -> None:
        self.responsive_sizes = dict(db_settings.responsive_sizes)
        self.quality_settings = dict(db_settings.quality_settings)
        self.avif_quality_base_offset = db_settings.avif_quality_base_offset
        self.avif_quality_floor = db_settings.avif_quality_floor
        self.avif_effort_default = db_settings.avif_effort_default
        self.webp_quality = db_settings.webp_quality
        self.rate_limit_enabled = db_settings.rate_limit_enabled
        self.rate_limit_calls = db_settings.rate_limit_calls
        self.rate_limit_period = db_settings.rate_limit_period
        self.rate_limit_file_calls = db_settings.rate_limit_file_calls
        self.rate_limit_file_period = db_settings.rate_limit_file_period
        self.rate_limit_auth_calls = db_settings.rate_limit_auth_calls
        self.rate_limit_auth_period = db_settings.rate_limit_auth_period

    async def load_from_db(
        self, session_maker: async_sessionmaker[AsyncSession]
    ) -> None:
        """Load settings from the database, creating a default row if missing."""
        try:
            async with session_maker() as session:
                db_settings = await self._fetch_or_create_db_settings(session)
                self._apply_db_settings(db_settings)
        except Exception:
            logger.exception("Failed to load settings from database")
