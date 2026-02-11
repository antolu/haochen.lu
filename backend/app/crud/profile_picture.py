from __future__ import annotations

from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.profile_picture import ProfilePicture
from app.schemas.profile_picture import ProfilePictureCreate, ProfilePictureUpdate
from app.types.images import ImageVariants


async def get_profile_pictures(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
) -> list[ProfilePicture]:
    """Get all profile pictures ordered by creation date."""
    result = await db.execute(
        select(ProfilePicture)
        .order_by(ProfilePicture.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_profile_picture_count(db: AsyncSession) -> int:
    """Get total count of profile pictures."""
    result = await db.execute(select(ProfilePicture))
    return len(list(result.scalars().all()))


async def get_profile_picture(
    db: AsyncSession, profile_picture_id: UUID
) -> ProfilePicture | None:
    """Get profile picture by ID."""
    result = await db.execute(
        select(ProfilePicture).where(ProfilePicture.id == profile_picture_id)
    )
    return result.scalar_one_or_none()


async def get_active_profile_picture(db: AsyncSession) -> ProfilePicture | None:
    """Get the currently active profile picture."""
    result = await db.execute(select(ProfilePicture).where(ProfilePicture.is_active))
    return result.scalar_one_or_none()


async def create_profile_picture(
    db: AsyncSession,
    profile_picture_data: ProfilePictureCreate,
    filename: str,
    original_path: str,
    variants: ImageVariants,
    file_size: int | None = None,
    width: int | None = None,
    height: int | None = None,
) -> ProfilePicture:
    """Create a new profile picture."""
    profile_picture = ProfilePicture(
        title=profile_picture_data.title,
        filename=filename,
        original_path=original_path,
        variants=variants,
        is_active=profile_picture_data.is_active,
        file_size=file_size,
        width=width,
        height=height,
    )

    # If this profile picture is set as active, deactivate all others
    if profile_picture_data.is_active:
        await deactivate_all_profile_pictures(db)

    db.add(profile_picture)
    await db.commit()
    await db.refresh(profile_picture)
    return profile_picture


async def update_profile_picture(
    db: AsyncSession,
    profile_picture_id: UUID,
    profile_picture_update: ProfilePictureUpdate,
) -> ProfilePicture | None:
    """Update profile picture metadata."""
    # Get the profile picture
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        return None

    # If setting this as active, deactivate all others first
    if profile_picture_update.is_active:
        await deactivate_all_profile_pictures(db)

    # Update fields
    update_data = profile_picture_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile_picture, field, value)

    await db.commit()
    await db.refresh(profile_picture)
    return profile_picture


async def activate_profile_picture(
    db: AsyncSession,
    profile_picture_id: UUID,
) -> ProfilePicture | None:
    """Set a profile picture as active and deactivate all others."""
    # First deactivate all profile pictures
    await deactivate_all_profile_pictures(db)

    # Then activate the specified one
    result = await db.execute(
        update(ProfilePicture)
        .where(ProfilePicture.id == profile_picture_id)
        .values(is_active=True)
        .returning(ProfilePicture)
    )
    profile_picture = result.scalar_one_or_none()

    if profile_picture:
        await db.commit()
        await db.refresh(profile_picture)

    return profile_picture


async def deactivate_all_profile_pictures(db: AsyncSession) -> None:
    """Deactivate all profile pictures."""
    await db.execute(update(ProfilePicture).values(is_active=False))


async def delete_profile_picture(db: AsyncSession, profile_picture_id: UUID) -> bool:
    """Delete a profile picture."""
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        return False

    await db.delete(profile_picture)
    await db.commit()
    return True
