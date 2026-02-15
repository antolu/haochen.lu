from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import asc, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import case

from app.models.photo import Photo
from app.schemas.photo import PhotoCreate, PhotoUpdate
from app.types.access_control import AccessLevel, FileType


async def get_photos(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    category: str | None = None,
    *,
    featured: bool | None = None,
    has_location: bool | None = None,
    near_lat: float | None = None,
    near_lon: float | None = None,
    radius: float = 10.0,
    order_by: str = "created_at",
    exclude_photo_ids: set[UUID] | None = None,
) -> list[Photo]:
    query = select(Photo)

    if category:
        query = query.where(Photo.category == category)

    if featured is not None:
        query = query.where(Photo.featured == featured)

    if has_location is not None:
        if has_location:
            query = query.where(
                Photo.location_lat.isnot(None) & Photo.location_lon.isnot(None)
            )
        else:
            query = query.where(
                Photo.location_lat.is_(None) | Photo.location_lon.is_(None)
            )

    if near_lat is not None and near_lon is not None:
        # Filter by proximity using Haversine formula approximation
        # For small distances, we can use a simple bounding box
        # Convert radius from km to degrees (rough approximation)
        lat_range = radius / 111.0  # 1 degree ≈ 111 km
        lon_range = radius / (111.0 * func.cos(func.radians(near_lat)))

        query = query.where(
            Photo.location_lat.between(near_lat - lat_range, near_lat + lat_range)
            & Photo.location_lon.between(near_lon - lon_range, near_lon + lon_range)
        )

    if exclude_photo_ids:
        query = query.where(Photo.id.notin_(list(exclude_photo_ids)))

    # Order by
    if order_by == "order":
        query = query.order_by(
            asc(Photo.order), desc(Photo.date_taken), desc(Photo.created_at)
        )
    elif order_by == "date_taken":
        query = query.order_by(desc(Photo.date_taken))
    elif order_by == "views":
        query = query.order_by(desc(Photo.view_count))
    elif order_by == "title":
        query = query.order_by(asc(Photo.title))
    else:
        query = query.order_by(desc(Photo.created_at))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_photo_count(
    db: AsyncSession,
    category: str | None = None,
    *,
    featured: bool | None = None,
    has_location: bool | None = None,
    near_lat: float | None = None,
    near_lon: float | None = None,
    radius: float = 10.0,
    exclude_photo_ids: set[UUID] | None = None,
) -> int:
    query = select(func.count(Photo.id))

    if category:
        query = query.where(Photo.category == category)

    if featured is not None:
        query = query.where(Photo.featured == featured)

    if has_location is not None:
        if has_location:
            query = query.where(
                Photo.location_lat.isnot(None) & Photo.location_lon.isnot(None)
            )
        else:
            query = query.where(
                Photo.location_lat.is_(None) | Photo.location_lon.is_(None)
            )

    if near_lat is not None and near_lon is not None:
        # Filter by proximity using same logic as get_photos
        lat_range = radius / 111.0
        lon_range = radius / (111.0 * func.cos(func.radians(near_lat)))

        query = query.where(
            Photo.location_lat.between(near_lat - lat_range, near_lat + lat_range)
            & Photo.location_lon.between(near_lon - lon_range, near_lon + lon_range)
        )

    if exclude_photo_ids:
        query = query.where(Photo.id.notin_(list(exclude_photo_ids)))

    result = await db.execute(query)
    count = result.scalar()
    return count or 0


async def get_photo(db: AsyncSession, photo_id: UUID) -> Photo | None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    return result.scalar_one_or_none()


async def validate_photo_access(
    db: AsyncSession,
    photo_id: UUID,
    file_type: FileType,
    *,
    user_id: str | None = None,
    is_admin: bool = False,
) -> Photo:
    """
    Validate if user can access specified photo file.

    Returns photo model if access is granted, raises HTTPException otherwise.
    """
    # Get photo from database
    photo = await get_photo(db, photo_id)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Get access level (default to public for existing photos)
    access_level = getattr(photo, "access_level", AccessLevel.PUBLIC)

    # Check access permissions
    if access_level == AccessLevel.PRIVATE and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    if access_level == AccessLevel.AUTHENTICATED and not user_id and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Additional restrictions for high-resolution files (only for non-public photos)
    if (
        file_type in [FileType.LARGE, FileType.XLARGE, FileType.ORIGINAL]
        and access_level != AccessLevel.PUBLIC
        and not (user_id or is_admin)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for high-resolution files",
        )

    return photo


async def create_photo(
    db: AsyncSession, photo: PhotoCreate, **kwargs: str | float | dict | None
) -> Photo:
    db_photo = Photo(**photo.model_dump(), **kwargs)
    db.add(db_photo)
    await db.commit()
    return db_photo


async def update_photo(
    db: AsyncSession, photo_id: UUID, photo: PhotoUpdate
) -> Photo | None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo: Photo | None = result.scalar_one_or_none()

    if db_photo:
        update_data = photo.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_photo, field, value)

        await db.commit()

    return db_photo


async def delete_photo(db: AsyncSession, photo_id: UUID) -> bool:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo: Photo | None = result.scalar_one_or_none()

    if db_photo:
        await db.delete(db_photo)
        await db.commit()
        return True

    return False


async def increment_view_count(db: AsyncSession, photo_id: UUID) -> None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo: Photo | None = result.scalar_one_or_none()

    if db_photo:
        db_photo.view_count = Photo.view_count + 1
        await db.commit()


async def bulk_reorder_photos(
    db: AsyncSession,
    items: list[tuple[UUID, int]] | list[dict[str, str | int]],
    *,
    normalize: bool = False,
) -> None:
    """Bulk update the order of multiple photos in a single transaction.

    Args:
        db: Async database session
        items: List of (photo_id, order) tuples or dicts with keys 'id' and 'order'
        normalize: If True, reassign orders to be consecutive starting from 0 based on
                   ascending provided order values, scoped to the provided items only.
    """
    if not items:
        return

    # Normalize input to list of tuples
    pairs: list[tuple[UUID, int]] = []
    for it in items:
        if isinstance(it, dict):
            pairs.append((UUID(str(it["id"])), int(it["order"])))
        else:
            pairs.append((UUID(str(it[0])), int(it[1])))

    if normalize:
        # Reassign orders to 0..n-1 based on ascending order
        pairs = [
            (pid, idx)
            for idx, (pid, _ord) in enumerate(sorted(pairs, key=lambda x: x[1]))
        ]

    ids = [pid for pid, _ in pairs]
    # Build CASE statement for bulk update using boolean whens
    order_case = case(
        *[(Photo.id == pid, ord_val) for pid, ord_val in pairs], else_=Photo.order
    )

    # Execute update
    await db.execute(update(Photo).where(Photo.id.in_(ids)).values(order=order_case))
    await db.commit()
