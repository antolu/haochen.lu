from __future__ import annotations

import asyncio
import contextlib
import logging
from dataclasses import dataclass, field

import sqlalchemy

from app.config import settings as static_settings
from app.database import async_session_maker
from app.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class ImageSettings:
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

    def apply(self, data: dict) -> None:
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


_image_settings = ImageSettings()
_refresh_task: asyncio.Task | None = None


def get_image_settings() -> ImageSettings:
    return _image_settings


def update_image_settings(data: dict) -> ImageSettings:
    _image_settings.apply(data)
    return _image_settings


class RefresherManager:
    task: asyncio.Task | None = None


async def _fetch_or_create_db_settings() -> SystemSetting | None:
    async with async_session_maker() as session:
        result = await session.execute(
            sqlalchemy.select(SystemSetting).where(SystemSetting.id == 1)
        )
        db_settings = result.scalar_one_or_none()
        if not db_settings:
            db_settings = SystemSetting(
                id=1,
                responsive_sizes=_image_settings.responsive_sizes,
                quality_settings=_image_settings.quality_settings,
                avif_quality_base_offset=_image_settings.avif_quality_base_offset,
                avif_quality_floor=_image_settings.avif_quality_floor,
                avif_effort_default=_image_settings.avif_effort_default,
                webp_quality=_image_settings.webp_quality,
                rate_limit_enabled=_image_settings.rate_limit_enabled,
                rate_limit_calls=_image_settings.rate_limit_calls,
                rate_limit_period=_image_settings.rate_limit_period,
                rate_limit_file_calls=_image_settings.rate_limit_file_calls,
                rate_limit_file_period=_image_settings.rate_limit_file_period,
                rate_limit_auth_calls=_image_settings.rate_limit_auth_calls,
                rate_limit_auth_period=_image_settings.rate_limit_auth_period,
            )
            session.add(db_settings)
            await session.commit()
            await session.refresh(db_settings)
        return db_settings


async def initialize_settings() -> None:
    """Initialize or sync the settings from the database."""
    try:
        db_settings = await _fetch_or_create_db_settings()
    except Exception:
        logger.exception("Failed to initialize settings from database")
        return

    if db_settings:
        _image_settings.responsive_sizes = dict(db_settings.responsive_sizes)
        _image_settings.quality_settings = dict(db_settings.quality_settings)
        _image_settings.avif_quality_base_offset = db_settings.avif_quality_base_offset
        _image_settings.avif_quality_floor = db_settings.avif_quality_floor
        _image_settings.avif_effort_default = db_settings.avif_effort_default
        _image_settings.webp_quality = db_settings.webp_quality
        _image_settings.rate_limit_enabled = db_settings.rate_limit_enabled
        _image_settings.rate_limit_calls = db_settings.rate_limit_calls
        _image_settings.rate_limit_period = db_settings.rate_limit_period
        _image_settings.rate_limit_file_calls = db_settings.rate_limit_file_calls
        _image_settings.rate_limit_file_period = db_settings.rate_limit_file_period
        _image_settings.rate_limit_auth_calls = db_settings.rate_limit_auth_calls
        _image_settings.rate_limit_auth_period = db_settings.rate_limit_auth_period


async def _settings_refresh_loop() -> None:
    while True:
        try:
            await asyncio.sleep(10)
            await initialize_settings()
        except asyncio.CancelledError:
            break
        except Exception:
            logger.exception("Error in settings refresh loop")


def start_settings_refresher() -> asyncio.Task:
    if RefresherManager.task is None or RefresherManager.task.done():
        RefresherManager.task = asyncio.create_task(_settings_refresh_loop())
    return RefresherManager.task


async def stop_settings_refresher() -> None:
    if RefresherManager.task and not RefresherManager.task.done():
        RefresherManager.task.cancel()

        with contextlib.suppress(asyncio.CancelledError):
            await RefresherManager.task
        RefresherManager.task = None
