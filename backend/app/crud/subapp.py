from __future__ import annotations

import secrets
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subapp import SubApp
from app.schemas.subapp import SubAppCreate, SubAppUpdate


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    return name.lower().replace(" ", "-").replace(".", "").replace(",", "")


def default_redirect_uri(url: str) -> str:
    return f"{url.rstrip('/')}/auth/callback"


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


async def get_subapp_by_client_id(db: AsyncSession, client_id: str) -> SubApp | None:
    result = await db.execute(select(SubApp).where(SubApp.client_id == client_id))
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
    if subapp_data.get("requires_auth"):
        subapp_data.setdefault("client_id", secrets.token_urlsafe(16))
        subapp_data.setdefault("client_secret", secrets.token_urlsafe(32))
        subapp_data.setdefault(
            "redirect_uris", default_redirect_uri(str(subapp_data["url"]))
        )

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
        if update_data.get("requires_auth"):
            update_data.setdefault(
                "client_id", db_subapp.client_id or secrets.token_urlsafe(16)
            )
            update_data.setdefault(
                "client_secret",
                db_subapp.client_secret or secrets.token_urlsafe(32),
            )
            update_data.setdefault(
                "redirect_uris",
                db_subapp.redirect_uris
                or default_redirect_uri(str(update_data.get("url") or db_subapp.url)),
            )
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
