from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.runtime_settings import get_image_settings, update_image_settings
from app.dependencies import _current_admin_user_dependency
from app.models.user import User

router = APIRouter()


class ImageSettingsResponse(BaseModel):
    """Image settings response model."""

    responsive_sizes: dict[str, int]
    quality_settings: dict[str, int]
    avif_quality_base_offset: int
    avif_quality_floor: int
    avif_effort_default: int
    webp_quality: int


class ImageSettingsUpdate(BaseModel):
    """Image settings update model."""

    responsive_sizes: dict[str, int] | None = None
    quality_settings: dict[str, int] | None = None
    avif_quality_base_offset: int | None = None
    avif_quality_floor: int | None = None
    avif_effort_default: int | None = None
    webp_quality: int | None = None


@router.get("/image")
async def get_image_runtime_settings(
    _current_user: User = _current_admin_user_dependency,
) -> ImageSettingsResponse:
    s = get_image_settings()
    return ImageSettingsResponse(
        responsive_sizes=s.responsive_sizes,
        quality_settings=s.quality_settings,
        avif_quality_base_offset=s.avif_quality_base_offset,
        avif_quality_floor=s.avif_quality_floor,
        avif_effort_default=s.avif_effort_default,
        webp_quality=s.webp_quality,
    )


@router.put("/image")
async def update_image_runtime_settings(
    payload: ImageSettingsUpdate,
    _current_user: User = _current_admin_user_dependency,
) -> ImageSettingsResponse:
    try:
        s = update_image_settings(payload.model_dump(exclude_unset=True))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid settings payload: {e!s}",
        ) from e
    else:
        return ImageSettingsResponse(
            responsive_sizes=s.responsive_sizes,
            quality_settings=s.quality_settings,
            avif_quality_base_offset=s.avif_quality_base_offset,
            avif_quality_floor=s.avif_quality_floor,
            avif_effort_default=s.avif_effort_default,
            webp_quality=s.webp_quality,
        )
