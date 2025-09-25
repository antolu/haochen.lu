from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository_service import repository_service
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title."""
    return title.lower().replace(" ", "-").replace(".", "").replace(",", "")


async def get_projects(
    db: AsyncSession,
    *,
    featured_only: bool = False,
    status: str | None = None,
    order_by: str = "created_at",
) -> list[Project]:
    query = select(Project)

    if featured_only:
        query = query.where(Project.featured)

    if status:
        query = query.where(Project.status == status)

    # Ordering
    if order_by == "order":
        query = query.order_by(
            asc(Project.order), desc(Project.updated_at), desc(Project.created_at)
        )
    elif order_by == "updated_at":
        query = query.order_by(desc(Project.updated_at))
    else:
        query = query.order_by(desc(Project.created_at))
    result = await db.execute(query)
    return list(result.scalars().all())


async def bulk_reorder_projects(
    db: AsyncSession,
    items: list[tuple[str, int]] | list[dict],
    *,
    normalize: bool = False,
) -> None:
    """Bulk update the order of multiple projects.

    Args:
        db: database session
        items: list of (project_id, order) or dicts {id, order}
        normalize: if True, reassign orders to 0..n-1 based on ascending provided order
    """
    if not items:
        return

    pairs: list[tuple[UUID, int]] = []
    for it in items:
        if isinstance(it, dict):
            pairs.append((UUID(str(it["id"])), int(it["order"])))
        else:
            pairs.append((UUID(str(it[0])), int(it[1])))

    if normalize:
        pairs = [
            (pid, idx)
            for idx, (pid, _ord) in enumerate(sorted(pairs, key=lambda x: x[1]))
        ]

    ids = [pid for pid, _ in pairs]
    order_case = func.case(
        *[(Project.id == pid, ord_val) for pid, ord_val in pairs], else_=Project.order
    )
    await db.execute(
        update(Project).where(Project.id.in_(ids)).values(order=order_case)
    )
    await db.commit()


async def get_project_count(db: AsyncSession) -> int:
    result = await db.execute(select(func.count(Project.id)))
    return result.scalar() or 0


async def get_project(db: AsyncSession, project_id: UUID) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def get_project_by_slug(db: AsyncSession, slug: str) -> Project | None:
    result = await db.execute(select(Project).where(Project.slug == slug))
    return result.scalar_one_or_none()


async def create_project(db: AsyncSession, project: ProjectCreate) -> Project:
    slug = project.slug or generate_slug(project.title)

    # Ensure unique slug
    counter = 1
    original_slug = slug
    while await get_project_by_slug(db, slug):
        slug = f"{original_slug}-{counter}"
        counter += 1

    project_data = project.model_dump()
    project_data["slug"] = slug

    # Parse repository URL if provided and not already parsed
    if project.github_url and not project.repository_type:
        repo_info = repository_service.parse_repository_url(project.github_url)
        if repo_info:
            project_data.update({
                "repository_type": repo_info.type,
                "repository_owner": repo_info.owner,
                "repository_name": repo_info.name,
            })

    db_project = Project(**project_data)
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    return db_project


async def update_project(
    db: AsyncSession, project_id: UUID, project: ProjectUpdate
) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    db_project = result.scalar_one_or_none()

    if db_project:
        update_data = project.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_project, field, value)

        await db.commit()
        await db.refresh(db_project)

    return db_project


async def delete_project(db: AsyncSession, project_id: UUID) -> bool:
    result = await db.execute(select(Project).where(Project.id == project_id))
    db_project = result.scalar_one_or_none()

    if db_project:
        await db.delete(db_project)
        await db.commit()
        return True

    return False


async def update_project_readme(
    db: AsyncSession,
    project_id: UUID,
    readme_content: str,
    last_updated: datetime | None,
) -> Project | None:
    """Update the cached README content for a project."""
    result = await db.execute(select(Project).where(Project.id == project_id))
    db_project = result.scalar_one_or_none()

    if db_project:
        db_project.readme_content = readme_content
        db_project.readme_last_updated = last_updated or datetime.utcnow()
        await db.commit()
        await db.refresh(db_project)

    return db_project
