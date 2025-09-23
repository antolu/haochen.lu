"""Hero images API endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.hero_image import (
    activate_hero_image,
    create_hero_image,
    delete_hero_image,
    get_active_hero_image,
    get_hero_image,
    get_hero_images,
    update_hero_image,
    update_hero_image_focal_points,
)
from app.dependencies import _current_admin_user_dependency, _session_dependency
from app.schemas.hero_image import (
    HeroImageActivate,
    HeroImageCreate,
    HeroImageFocalPointUpdate,
    HeroImageResponse,
    HeroImageUpdate,
)

router = APIRouter()


def populate_hero_image_urls(hero_image_dict: dict, photo_dict: dict) -> dict:
    """Add photo URLs to hero image response."""
    if photo_dict:
        # Add original file URL
        photo_id = photo_dict["id"]
        photo_dict["original_url"] = f"/api/photos/{photo_id}/file"
        photo_dict["download_url"] = f"/api/photos/{photo_id}/download"

        # Add variant URLs
        if photo_dict.get("variants"):
            for variant_name, variant_data in photo_dict["variants"].items():
                variant_data["url"] = f"/api/photos/{photo_id}/file/{variant_name}"

    return hero_image_dict


@router.get("", response_model=list[HeroImageResponse])
async def list_hero_images(
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> list[HeroImageResponse]:
    """Get all hero images."""
    hero_images = await get_hero_images(db)

    result = []
    for hero_image in hero_images:
        hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
        photo_dict = hero_image_dict.get("photo", {})
        populate_hero_image_urls(hero_image_dict, photo_dict)
        result.append(HeroImageResponse.model_validate(hero_image_dict))

    return result


@router.get("/active", response_model=HeroImageResponse | None)
async def get_active_hero(
    db: AsyncSession = _session_dependency,
) -> HeroImageResponse | None:
    """Get the currently active hero image. Public endpoint."""
    hero_image = await get_active_hero_image(db)
    if not hero_image:
        return None

    hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
    photo_dict = hero_image_dict.get("photo", {})
    populate_hero_image_urls(hero_image_dict, photo_dict)

    return HeroImageResponse.model_validate(hero_image_dict)


@router.get("/{hero_image_id}", response_model=HeroImageResponse)
async def get_hero_image_by_id(
    hero_image_id: UUID,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> HeroImageResponse:
    """Get a specific hero image by ID."""
    hero_image = await get_hero_image(db, hero_image_id)
    if not hero_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Hero image not found"
        )

    hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
    photo_dict = hero_image_dict.get("photo", {})
    populate_hero_image_urls(hero_image_dict, photo_dict)

    return HeroImageResponse.model_validate(hero_image_dict)


@router.post("", response_model=HeroImageResponse, status_code=status.HTTP_201_CREATED)
async def create_new_hero_image(
    hero_image_data: HeroImageCreate,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> HeroImageResponse:
    """Create a new hero image."""
    try:
        hero_image = await create_hero_image(db, hero_image_data)

        hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
        photo_dict = hero_image_dict.get("photo", {})
        populate_hero_image_urls(hero_image_dict, photo_dict)

        return HeroImageResponse.model_validate(hero_image_dict)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create hero image: {e!s}",
        ) from e


@router.put("/{hero_image_id}", response_model=HeroImageResponse)
async def update_hero_image_by_id(
    hero_image_id: UUID,
    hero_image_update: HeroImageUpdate,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> HeroImageResponse:
    """Update a hero image."""
    hero_image = await update_hero_image(db, hero_image_id, hero_image_update)
    if not hero_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Hero image not found"
        )

    hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
    photo_dict = hero_image_dict.get("photo", {})
    populate_hero_image_urls(hero_image_dict, photo_dict)

    return HeroImageResponse.model_validate(hero_image_dict)


@router.put("/{hero_image_id}/focal-points", response_model=HeroImageResponse)
async def update_focal_points(
    hero_image_id: UUID,
    focal_point_update: HeroImageFocalPointUpdate,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> HeroImageResponse:
    """Update focal points for a hero image."""
    hero_image = await update_hero_image_focal_points(
        db, hero_image_id, focal_point_update
    )
    if not hero_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Hero image not found"
        )

    hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
    photo_dict = hero_image_dict.get("photo", {})
    populate_hero_image_urls(hero_image_dict, photo_dict)

    return HeroImageResponse.model_validate(hero_image_dict)


@router.post("/{hero_image_id}/activate", response_model=HeroImageResponse)
async def activate_hero_image_by_id(
    hero_image_id: UUID,
    _data: HeroImageActivate,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> HeroImageResponse:
    """Activate a hero image (deactivates all others)."""
    hero_image = await activate_hero_image(db, hero_image_id)
    if not hero_image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Hero image not found"
        )

    hero_image_dict = HeroImageResponse.model_validate(hero_image).model_dump()
    photo_dict = hero_image_dict.get("photo", {})
    populate_hero_image_urls(hero_image_dict, photo_dict)

    return HeroImageResponse.model_validate(hero_image_dict)


@router.delete("/{hero_image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_hero_image_by_id(
    hero_image_id: UUID,
    db: AsyncSession = _session_dependency,
    _: None = _current_admin_user_dependency,
) -> None:
    """Delete a hero image."""
    success = await delete_hero_image(db, hero_image_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Hero image not found"
        )
