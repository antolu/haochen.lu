from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.core.runtime_settings import get_image_settings, update_image_settings
from app.dependencies import _current_admin_user_dependency

router = APIRouter()


@router.get("/image")
async def get_image_runtime_settings(_current_user=_current_admin_user_dependency):
    s = get_image_settings()
    return {
        "responsive_sizes": s.responsive_sizes,
        "quality_settings": s.quality_settings,
        "avif_quality_base_offset": s.avif_quality_base_offset,
        "avif_quality_floor": s.avif_quality_floor,
        "avif_effort_default": s.avif_effort_default,
        "webp_quality": s.webp_quality,
    }


@router.put("/image")
async def update_image_runtime_settings(
    payload: dict, _current_user=_current_admin_user_dependency
):
    try:
        s = update_image_settings(payload or {})
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid settings payload: {e!s}",
        ) from e
    else:
        return {
            "responsive_sizes": s.responsive_sizes,
            "quality_settings": s.quality_settings,
            "avif_quality_base_offset": s.avif_quality_base_offset,
            "avif_quality_floor": s.avif_quality_floor,
            "avif_effort_default": s.avif_effort_default,
            "webp_quality": s.webp_quality,
        }
