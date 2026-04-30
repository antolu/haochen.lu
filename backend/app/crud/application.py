from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.application import Application
from app.schemas.application import ApplicationCreate, ApplicationUpdate


def generate_slug(name: str) -> str:
    """Generate URL-friendly slug from name."""
    return name.lower().replace(" ", "-").replace(".", "").replace(",", "")


async def get_applications(
    db: AsyncSession,
    *,
    enabled_only: bool = True,
    admin_only: bool | None = None,
) -> list[Application]:
    query = select(Application)

    if enabled_only:
        query = query.where(Application.enabled)

    if admin_only is not None:
        query = query.where(Application.admin_only == admin_only)

    query = query.order_by(Application.order, Application.name)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_application_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Application.id)))
    count = result.scalar()
    return count or 0


async def get_application(db: AsyncSession, application_id: UUID) -> Application | None:
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    return result.scalar_one_or_none()


async def get_application_by_slug(db: AsyncSession, slug: str) -> Application | None:
    result = await db.execute(select(Application).where(Application.slug == slug))
    return result.scalar_one_or_none()


async def _next_order(db: AsyncSession) -> int:
    result = await db.execute(select(func.max(Application.order)))
    current_max = result.scalar()
    return (current_max or 0) + 1


async def create_application(db: AsyncSession, app: ApplicationCreate) -> Application:
    slug = app.slug or generate_slug(app.name)

    # Ensure unique slug
    counter = 1
    original_slug = slug
    while await get_application_by_slug(db, slug):
        slug = f"{original_slug}-{counter}"
        counter += 1

    app_data = app.model_dump()
    app_data["slug"] = slug
    app_data["order"] = await _next_order(db)

    db_app = Application(**app_data)
    db.add(db_app)
    await db.commit()
    await db.refresh(db_app)
    return db_app


async def update_application(
    db: AsyncSession, application_id: UUID, app: ApplicationUpdate
) -> Application | None:
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    db_app = result.scalar_one_or_none()

    if db_app:
        update_data = app.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_app, field, value)

        await db.commit()
        await db.refresh(db_app)

    return db_app


async def bulk_reorder_applications(
    db: AsyncSession,
    items: list[dict[str, str | int]],
    *,
    normalize: bool = False,
) -> None:
    pairs: list[tuple[UUID, int]] = [
        (UUID(str(it["id"])), int(it["order"])) for it in items
    ]
    if normalize:
        pairs = [
            (pid, idx) for idx, (pid, _) in enumerate(sorted(pairs, key=lambda x: x[1]))
        ]
    for app_id, order in pairs:
        result = await db.execute(select(Application).where(Application.id == app_id))
        db_app = result.scalar_one_or_none()
        if db_app:
            db_app.order = order
    await db.commit()


async def delete_application(db: AsyncSession, application_id: UUID) -> bool:
    result = await db.execute(
        select(Application).where(Application.id == application_id)
    )
    db_app = result.scalar_one_or_none()

    if db_app:
        await db.delete(db_app)
        await db.commit()
        return True

    return False
