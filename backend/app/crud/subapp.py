from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subapp import SubApp
from app.schemas.subapp import SubAppCreate, SubAppUpdate


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    return name.lower().replace(" ", "-").replace(".", "").replace(",", "")


async def get_subapps(
    db: AsyncSession,
    *,
    enabled_only: bool = True,
    menu_only: bool = True,
    admin_only: bool | None = None,
) -> list[SubApp]:
    query = select(SubApp)

    if enabled_only:
        query = query.where(SubApp.enabled)

    if menu_only:
        query = query.where(SubApp.show_in_menu)

    if admin_only is not None:
        query = query.where(SubApp.admin_only == admin_only)

    query = query.order_by(SubApp.order, SubApp.name)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_subapp_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(SubApp.id)))
    count = result.scalar()
    return count or 0


async def get_subapp(db: AsyncSession, subapp_id: UUID) -> SubApp | None:
    result = await db.execute(select(SubApp).where(SubApp.id == subapp_id))
    return result.scalar_one_or_none()


async def get_subapp_by_slug(db: AsyncSession, slug: str) -> SubApp | None:
    result = await db.execute(select(SubApp).where(SubApp.slug == slug))
    return result.scalar_one_or_none()


async def create_subapp(db: AsyncSession, subapp: SubAppCreate) -> SubApp:
    slug = subapp.slug or generate_slug(subapp.name)

    # Ensure unique slug
    counter = 1
    original_slug = slug
    while await get_subapp_by_slug(db, slug):
        slug = f"{original_slug}-{counter}"
        counter += 1

    subapp_data = subapp.model_dump()
    subapp_data["slug"] = slug

    db_subapp = SubApp(**subapp_data)
    db.add(db_subapp)
    await db.commit()
    await db.refresh(db_subapp)
    return db_subapp


async def update_subapp(
    db: AsyncSession, subapp_id: UUID, subapp: SubAppUpdate
) -> SubApp | None:
    result = await db.execute(select(SubApp).where(SubApp.id == subapp_id))
    db_subapp = result.scalar_one_or_none()

    if db_subapp:
        update_data = subapp.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_subapp, field, value)

        await db.commit()
        await db.refresh(db_subapp)

    return db_subapp


async def delete_subapp(db: AsyncSession, subapp_id: UUID) -> bool:
    result = await db.execute(select(SubApp).where(SubApp.id == subapp_id))
    db_subapp = result.scalar_one_or_none()

    if db_subapp:
        await db.delete(db_subapp)
        await db.commit()
        return True

    return False
