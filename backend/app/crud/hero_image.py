"""CRUD operations for hero images."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.hero_image import HeroImage
from app.schemas.hero_image import (
    HeroImageCreate,
    HeroImageFocalPointUpdate,
    HeroImageUpdate,
)


async def get_hero_images(db: AsyncSession) -> list[HeroImage]:
    """Get all hero images with photos."""
    query = (
        select(HeroImage)
        .options(selectinload(HeroImage.photo))
        .order_by(HeroImage.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_active_hero_image(db: AsyncSession) -> HeroImage | None:
    """Get the currently active hero image."""
    query = (
        select(HeroImage)
        .options(selectinload(HeroImage.photo))
        .where(HeroImage.is_active)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_hero_image(db: AsyncSession, hero_image_id: UUID) -> HeroImage | None:
    """Get a hero image by ID."""
    query = (
        select(HeroImage)
        .options(selectinload(HeroImage.photo))
        .where(HeroImage.id == hero_image_id)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def create_hero_image(db: AsyncSession, hero_image: HeroImageCreate) -> HeroImage:
    """Create a new hero image."""
    # Convert ResponsiveFocalPoints to dict for JSON storage
    focal_points_dict = None
    if hero_image.focal_points_responsive:
        focal_points_dict = {}
        for device in ["mobile", "tablet", "desktop"]:
            device_point = getattr(hero_image.focal_points_responsive, device, None)
            if device_point:
                focal_points_dict[device] = {"x": device_point.x, "y": device_point.y}

    db_hero_image = HeroImage(
        title=hero_image.title,
        photo_id=hero_image.photo_id,
        focal_point_x=hero_image.focal_point_x,
        focal_point_y=hero_image.focal_point_y,
        focal_points_responsive=focal_points_dict,
        is_active=False,  # New hero images are not active by default
    )
    db.add(db_hero_image)
    await db.commit()
    await db.refresh(db_hero_image)

    # Load the photo relationship
    await db.refresh(db_hero_image, attribute_names=["photo"])
    return db_hero_image


async def update_hero_image(
    db: AsyncSession, hero_image_id: UUID, hero_image_update: HeroImageUpdate
) -> HeroImage | None:
    """Update a hero image."""
    # Get the existing hero image
    db_hero_image = await get_hero_image(db, hero_image_id)
    if not db_hero_image:
        return None

    update_data = hero_image_update.model_dump(exclude_unset=True)

    # Handle responsive focal points conversion
    if update_data.get("focal_points_responsive"):
        focal_points_dict = {}
        responsive_points = update_data["focal_points_responsive"]
        for device in ["mobile", "tablet", "desktop"]:
            device_point = (
                getattr(responsive_points, device, None)
                if hasattr(responsive_points, device)
                else responsive_points.get(device)
            )
            if device_point:
                focal_points_dict[device] = {
                    "x": device_point.x
                    if hasattr(device_point, "x")
                    else device_point["x"],
                    "y": device_point.y
                    if hasattr(device_point, "y")
                    else device_point["y"],
                }
        update_data["focal_points_responsive"] = focal_points_dict

    # Update the hero image
    for field, value in update_data.items():
        setattr(db_hero_image, field, value)

    await db.commit()
    await db.refresh(db_hero_image)
    await db.refresh(db_hero_image, attribute_names=["photo"])
    return db_hero_image


async def update_hero_image_focal_points(
    db: AsyncSession, hero_image_id: UUID, focal_point_update: HeroImageFocalPointUpdate
) -> HeroImage | None:
    """Update only the focal points of a hero image."""
    # Get the existing hero image
    db_hero_image = await get_hero_image(db, hero_image_id)
    if not db_hero_image:
        return None

    # Convert ResponsiveFocalPoints to dict for JSON storage
    focal_points_dict = None
    if focal_point_update.focal_points_responsive:
        focal_points_dict = {}
        for device in ["mobile", "tablet", "desktop"]:
            device_point = getattr(
                focal_point_update.focal_points_responsive, device, None
            )
            if device_point:
                focal_points_dict[device] = {"x": device_point.x, "y": device_point.y}

    # Update focal points
    db_hero_image.focal_point_x = focal_point_update.focal_point_x  # type: ignore[assignment]
    db_hero_image.focal_point_y = focal_point_update.focal_point_y  # type: ignore[assignment]
    db_hero_image.focal_points_responsive = focal_points_dict  # type: ignore[assignment]

    await db.commit()
    await db.refresh(db_hero_image)
    await db.refresh(db_hero_image, attribute_names=["photo"])
    return db_hero_image


async def activate_hero_image(
    db: AsyncSession, hero_image_id: UUID
) -> HeroImage | None:
    """Activate a hero image (deactivate all others)."""
    # First deactivate all hero images
    await db.execute(update(HeroImage).values(is_active=False))

    # Then activate the specified one
    result = await db.execute(
        update(HeroImage)
        .where(HeroImage.id == hero_image_id)
        .values(is_active=True)
        .returning(HeroImage.id)
    )

    if not result.first():
        return None

    await db.commit()

    # Return the activated hero image
    return await get_hero_image(db, hero_image_id)


async def delete_hero_image(db: AsyncSession, hero_image_id: UUID) -> bool:
    """Delete a hero image."""
    db_hero_image = await get_hero_image(db, hero_image_id)
    if not db_hero_image:
        return False

    await db.delete(db_hero_image)
    await db.commit()
    return True


async def get_hero_images_by_photo_id(
    db: AsyncSession, photo_id: UUID
) -> list[HeroImage]:
    """Get all hero images for a specific photo."""
    query = (
        select(HeroImage)
        .where(HeroImage.photo_id == photo_id)
        .order_by(HeroImage.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())
