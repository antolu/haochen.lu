from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository_service import repository_service
from app.core.vips_processor import vips_image_processor
from app.crud.photo import delete_photo, get_photo
from app.models.project import Project
from app.models.project_image import ProjectImage
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


async def delete_project_and_media(db: AsyncSession, project_id: UUID) -> bool:
    """Delete a project and remove orphaned photos and files referenced only by this project.

    - Deletes the project (cascades project_images)
    - For each photo previously attached to this project, if not referenced by any other
      project_images or hero_images, delete photo files from disk and delete the photo row.
    """
    # Collect photo_ids referenced by this project before deletion
    result = await db.execute(
        select(ProjectImage.photo_id).where(ProjectImage.project_id == project_id)
    )
    photo_ids = [row[0] for row in result.all()]

    # Delete the project (CASCADE removes project_images rows)
    deleted = await delete_project(db, project_id)
    if not deleted:
        return False

    # Since project photos are not reused elsewhere in current design,
    # delete all referenced photos and their files.
    for pid in photo_ids:
        photo = await get_photo(db, pid)
        if photo:
            try:
                photo_dict: dict[str, object] = {
                    "original_path": photo.original_path,
                    "variants": photo.variants or {},
                }
                await vips_image_processor.delete_image_files(photo_dict)
            except Exception:
                ...
            await delete_photo(db, pid)

    return True


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


# Project images helpers
async def list_project_images(
    db: AsyncSession, project_id: UUID, skip: int = 0, limit: int = 10
) -> list[ProjectImage]:
    result = await db.execute(
        select(ProjectImage)
        .where(ProjectImage.project_id == project_id)
        .order_by(asc(ProjectImage.order), asc(ProjectImage.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def attach_project_image(
    db: AsyncSession,
    *,
    project_id: UUID,
    photo_id: UUID,
    title: str | None = None,
    alt_text: str | None = None,
) -> ProjectImage:
    # Determine next order within project
    res = await db.execute(
        select(ProjectImage.order)
        .where(ProjectImage.project_id == project_id)
        .order_by(desc(ProjectImage.order))
        .limit(1)
    )
    last_order = res.scalar() or 0
    pi = ProjectImage(
        project_id=project_id,
        photo_id=photo_id,
        title=title,
        alt_text=alt_text,
        order=last_order + 1,
    )
    db.add(pi)
    await db.commit()
    await db.refresh(pi)
    return pi


async def remove_project_image(db: AsyncSession, project_image_id: UUID) -> bool:
    res = await db.execute(
        select(ProjectImage).where(ProjectImage.id == project_image_id)
    )
    pi = res.scalar_one_or_none()
    if not pi:
        return False
    await db.delete(pi)
    await db.commit()
    return True


async def reorder_project_images(
    db: AsyncSession, project_id: UUID, items: list[dict], *, normalize: bool = True
) -> None:
    if not items:
        return
    pairs: list[tuple[UUID, int]] = [
        (UUID(str(it["id"])), int(it["order"])) for it in items
    ]
    if normalize:
        pairs = [
            (pid, idx)
            for idx, (pid, _ord) in enumerate(sorted(pairs, key=lambda x: x[1]))
        ]

    ids = [pid for pid, _ in pairs]
    order_case = func.case(
        *[(ProjectImage.id == pid, ord_val) for pid, ord_val in pairs],
        else_=ProjectImage.order,
    )
    await db.execute(
        update(ProjectImage)
        .where(ProjectImage.id.in_(ids), ProjectImage.project_id == project_id)
        .values(order=order_case)
    )
    await db.commit()
