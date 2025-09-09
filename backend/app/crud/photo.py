from __future__ import annotations

from uuid import UUID
from sqlalchemy import select, func, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.photo import Photo
from app.schemas.photo import PhotoCreate, PhotoUpdate


async def get_photos(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    category: str | None = None,
    featured: bool | None = None,
    order_by: str = "created_at"
) -> list[Photo]:
    query = select(Photo)
    
    if category:
        query = query.where(Photo.category == category)
    
    if featured is not None:
        query = query.where(Photo.featured == featured)
    
    # Order by
    if order_by == "date_taken":
        query = query.order_by(desc(Photo.date_taken))
    elif order_by == "views":
        query = query.order_by(desc(Photo.view_count))
    elif order_by == "title":
        query = query.order_by(asc(Photo.title))
    else:
        query = query.order_by(desc(Photo.created_at))
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_photo_count(
    db: AsyncSession,
    category: str | None = None,
    featured: bool | None = None
) -> int:
    query = select(func.count(Photo.id))
    
    if category:
        query = query.where(Photo.category == category)
    
    if featured is not None:
        query = query.where(Photo.featured == featured)
    
    result = await db.execute(query)
    return result.scalar()


async def get_photo(db: AsyncSession, photo_id: UUID) -> Photo | None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    return result.scalar_one_or_none()


async def create_photo(db: AsyncSession, photo: PhotoCreate, **kwargs) -> Photo:
    db_photo = Photo(**photo.model_dump(), **kwargs)
    db.add(db_photo)
    await db.commit()
    await db.refresh(db_photo)
    return db_photo


async def update_photo(db: AsyncSession, photo_id: UUID, photo: PhotoUpdate) -> Photo | None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo = result.scalar_one_or_none()
    
    if db_photo:
        update_data = photo.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_photo, field, value)
        
        await db.commit()
        await db.refresh(db_photo)
    
    return db_photo


async def delete_photo(db: AsyncSession, photo_id: UUID) -> bool:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo = result.scalar_one_or_none()
    
    if db_photo:
        await db.delete(db_photo)
        await db.commit()
        return True
    
    return False


async def increment_view_count(db: AsyncSession, photo_id: UUID) -> None:
    result = await db.execute(select(Photo).where(Photo.id == photo_id))
    db_photo = result.scalar_one_or_none()
    
    if db_photo:
        db_photo.view_count += 1
        await db.commit()