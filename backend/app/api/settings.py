from __future__ import annotations

import sqlalchemy
import sqlalchemy.ext.asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.config import settings as static_settings
from app.core.runtime_settings import get_image_settings, update_image_settings
from app.database import get_session
from app.dependencies import _current_admin_user_dependency
from app.models.system_setting import SystemSetting
from app.models.user import User

router = APIRouter()
db_dependency = Depends(get_session)


class SystemSettingsResponse(BaseModel):
    responsive_sizes: dict[str, int]
    quality_settings: dict[str, int]
    avif_quality_base_offset: int
    avif_quality_floor: int
    avif_effort_default: int
    webp_quality: int
    rate_limit_enabled: bool
    rate_limit_calls: int
    rate_limit_period: int
    rate_limit_file_calls: int
    rate_limit_file_period: int
    rate_limit_auth_calls: int
    rate_limit_auth_period: int
    rate_limit_locked: bool


class SystemSettingsUpdate(BaseModel):
    responsive_sizes: dict[str, int] | None = None
    quality_settings: dict[str, int] | None = None
    avif_quality_base_offset: int | None = None
    avif_quality_floor: int | None = None
    avif_effort_default: int | None = None
    webp_quality: int | None = None
    rate_limit_enabled: bool | None = None
    rate_limit_calls: int | None = None
    rate_limit_period: int | None = None
    rate_limit_file_calls: int | None = None
    rate_limit_file_period: int | None = None
    rate_limit_auth_calls: int | None = None
    rate_limit_auth_period: int | None = None


@router.get("")
async def get_system_runtime_settings(
    _current_user: User = _current_admin_user_dependency,
) -> SystemSettingsResponse:
    s = get_image_settings()
    return SystemSettingsResponse(
        responsive_sizes=s.responsive_sizes,
        quality_settings=s.quality_settings,
        avif_quality_base_offset=s.avif_quality_base_offset,
        avif_quality_floor=s.avif_quality_floor,
        avif_effort_default=s.avif_effort_default,
        webp_quality=s.webp_quality,
        rate_limit_enabled=s.rate_limit_enabled,
        rate_limit_calls=s.rate_limit_calls,
        rate_limit_period=s.rate_limit_period,
        rate_limit_file_calls=s.rate_limit_file_calls,
        rate_limit_file_period=s.rate_limit_file_period,
        rate_limit_auth_calls=s.rate_limit_auth_calls,
        rate_limit_auth_period=s.rate_limit_auth_period,
        rate_limit_locked=static_settings.is_rate_limit_env_set,
    )


@router.put("")
async def update_system_runtime_settings(
    payload: SystemSettingsUpdate,
    db: sqlalchemy.ext.asyncio.AsyncSession = db_dependency,
    _current_user: User = _current_admin_user_dependency,
) -> SystemSettingsResponse:
    if (
        payload.rate_limit_enabled is not None
        and static_settings.is_rate_limit_env_set
        and payload.rate_limit_enabled != static_settings.rate_limit_enabled
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rate limiting status is locked by server configuration and cannot be modified.",
        )

    try:
        result = await db.execute(
            sqlalchemy.select(SystemSetting).where(SystemSetting.id == 1)
        )
        db_settings = result.scalar_one_or_none()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database read error: {e!s}",
        ) from e

    update_data = payload.model_dump(exclude_unset=True)

    if not db_settings:
        db_settings = SystemSetting(
            id=1,
            responsive_sizes=update_data.get("responsive_sizes", {}),
            quality_settings=update_data.get("quality_settings", {}),
            avif_quality_base_offset=update_data.get("avif_quality_base_offset", -10),
            avif_quality_floor=update_data.get("avif_quality_floor", 50),
            avif_effort_default=update_data.get("avif_effort_default", 6),
            webp_quality=update_data.get("webp_quality", 85),
            rate_limit_enabled=update_data.get("rate_limit_enabled", True),
            rate_limit_calls=update_data.get("rate_limit_calls", 100),
            rate_limit_period=update_data.get("rate_limit_period", 3600),
            rate_limit_file_calls=update_data.get("rate_limit_file_calls", 20),
            rate_limit_file_period=update_data.get("rate_limit_file_period", 60),
            rate_limit_auth_calls=update_data.get("rate_limit_auth_calls", 60),
            rate_limit_auth_period=update_data.get("rate_limit_auth_period", 60),
        )
        db.add(db_settings)
    else:
        for key, val in update_data.items():
            setattr(db_settings, key, val)

    try:
        await db.commit()
        await db.refresh(db_settings)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database write error: {e!s}",
        ) from e

    s = update_image_settings(update_data)

    return SystemSettingsResponse(
        responsive_sizes=s.responsive_sizes,
        quality_settings=s.quality_settings,
        avif_quality_base_offset=s.avif_quality_base_offset,
        avif_quality_floor=s.avif_quality_floor,
        avif_effort_default=s.avif_effort_default,
        webp_quality=s.webp_quality,
        rate_limit_enabled=s.rate_limit_enabled,
        rate_limit_calls=s.rate_limit_calls,
        rate_limit_period=s.rate_limit_period,
        rate_limit_file_calls=s.rate_limit_file_calls,
        rate_limit_file_period=s.rate_limit_file_period,
        rate_limit_auth_calls=s.rate_limit_auth_calls,
        rate_limit_auth_period=s.rate_limit_auth_period,
        rate_limit_locked=static_settings.is_rate_limit_env_set,
    )
