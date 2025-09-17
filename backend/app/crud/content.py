from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.schemas.content import ContentCreate, ContentUpdate


async def get_content_by_key(db: AsyncSession, key: str) -> Content | None:
    """Retrieve content by its unique key."""
    result = await db.execute(select(Content).filter(Content.key == key))
    return result.scalar_one_or_none()


async def get_public_content_by_keys(
    db: AsyncSession, keys: list[str]
) -> list[Content]:
    """Retrieve active content items by a list of keys."""
    result = await db.execute(
        select(Content).filter(Content.key.in_(keys), Content.is_active)
    )
    return result.scalars().all()


async def get_public_content_by_category(
    db: AsyncSession, category: str
) -> list[Content]:
    """Retrieve active content items by category."""
    result = await db.execute(
        select(Content).filter(Content.category == category, Content.is_active)
    )
    return result.scalars().all()


async def get_content_by_id(db: AsyncSession, content_id: str) -> Content | None:
    """Get content by ID."""
    result = await db.execute(select(Content).filter(Content.id == content_id))
    return result.scalar_one_or_none()


async def get_content_list(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 10,
    category: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    order_by: str = "created_at",
    order_direction: str = "desc",
) -> dict[str, Any]:
    """Get paginated list of content items."""
    query = select(Content)

    if category:
        query = query.filter(Content.category == category)
    if is_active is not None:
        query = query.filter(Content.is_active == is_active)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Content.title.ilike(search_pattern))
            | (Content.content.ilike(search_pattern))
        )

    # Apply ordering
    if order_direction.lower() == "desc":
        query = query.order_by(getattr(Content, order_by).desc())
    else:
        query = query.order_by(getattr(Content, order_by).asc())

    # Count total items before pagination
    total_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total_items = total_result.scalar_one()

    # Apply pagination
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    content_items = result.scalars().all()

    return {
        "content": content_items,
        "total": total_items,
        "page": page,
        "per_page": per_page,
        "pages": (total_items + per_page - 1) // per_page,
    }


async def create_content(db: AsyncSession, content_data: ContentCreate) -> Content:
    """Create a new content item."""
    content = Content(**content_data.model_dump())
    db.add(content)
    await db.commit()
    await db.refresh(content)
    return content


async def update_content(
    db: AsyncSession, content_id: str, content_data: ContentUpdate
) -> Content | None:
    """Update existing content."""
    result = await db.execute(select(Content).filter(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        return None

    # Update only provided fields
    update_data = content_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(content, field, value)

    await db.commit()
    await db.refresh(content)
    return content


async def delete_content(db: AsyncSession, content_id: str) -> bool:
    """Delete content by ID."""
    result = await db.execute(select(Content).filter(Content.id == content_id))
    content = result.scalar_one_or_none()

    if not content:
        return False

    await db.delete(content)
    await db.commit()
    return True
