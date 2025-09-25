from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository_service import RepositoryInfo, repository_service
from app.crud.project import (
    attach_project_image,
    bulk_reorder_projects,
    create_project,
    delete_project_and_media,
    get_project,
    get_project_by_slug,
    get_project_count,
    get_projects,
    list_project_images,
    remove_project_image,
    reorder_project_images,
    update_project,
    update_project_readme,
)
from app.dependencies import (
    _current_admin_user_dependency,
    _session_dependency,
)
from app.models.project import Project as ProjectModel
from app.models.project_image import ProjectImage
from app.schemas.project import (
    ProjectCreate,
    ProjectImageAttach,
    ProjectImageReorderRequest,
    ProjectImageResponse,
    ProjectListResponse,
    ProjectPreviewResponse,
    ProjectReorderRequest,
    ProjectResponse,
    ProjectUpdate,
    ReadmeResponse,
)

router = APIRouter()
MAX_PROJECT_IMAGES = 10


def _populate_photo_urls(photo_dict: dict) -> None:
    """Populate photo file and variant URLs similar to hero_images endpoint."""
    if not photo_dict:
        return
    photo_id = photo_dict.get("id")
    if not photo_id:
        return
    photo_dict["original_url"] = f"/api/photos/{photo_id}/file"
    photo_dict["download_url"] = f"/api/photos/{photo_id}/download"
    variants = photo_dict.get("variants")
    if isinstance(variants, dict):
        for variant_name, variant_data in variants.items():
            if isinstance(variant_data, dict):
                # Provide size-level URL where missing
                variant_data.setdefault(
                    "url", f"/api/photos/{photo_id}/file/{variant_name}"
                )
                # For nested multi-format variants, attach url too
                for fmt_data in variant_data.values():
                    if isinstance(fmt_data, dict) and "filename" in fmt_data:
                        fmt_data["url"] = f"/api/photos/{photo_id}/file/{variant_name}"


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    *,
    featured_only: bool = False,
    status: str | None = None,
    order_by: str = Query("created_at", regex="^(created_at|updated_at|order)$"),
    db: AsyncSession = _session_dependency,
):
    """List all projects."""
    projects = await get_projects(
        db, featured_only=featured_only, status=status, order_by=order_by
    )

    total = await get_project_count(db)

    # Build responses with cover_image_url populated from first project image
    responses: list[ProjectResponse] = []
    for project in projects:
        resp = ProjectResponse.model_validate(project).model_dump()
        images = await list_project_images(db, project.id)
        if images:
            img_dict = ProjectImageResponse.model_validate(images[0]).model_dump()
            photo_dict = img_dict.get("photo") or {}
            _populate_photo_urls(photo_dict)
            resp["cover_image_url"] = (
                photo_dict.get("variants", {}).get("thumbnail", {}).get("url")
                or photo_dict.get("variants", {}).get("small", {}).get("url")
                or photo_dict.get("original_url")
            )
        responses.append(ProjectResponse.model_validate(resp))

    return ProjectListResponse(projects=responses, total=total)


@router.get("/featured", response_model=list[ProjectResponse])
async def list_featured_projects(db: AsyncSession = _session_dependency):
    """Get featured projects."""
    projects = await get_projects(db, featured_only=True)
    responses: list[ProjectResponse] = []
    for project in projects:
        resp = ProjectResponse.model_validate(project).model_dump()
        images = await list_project_images(db, project.id)
        if images:
            img_dict = ProjectImageResponse.model_validate(images[0]).model_dump()
            photo_dict = img_dict.get("photo") or {}
            _populate_photo_urls(photo_dict)
            resp["cover_image_url"] = (
                photo_dict.get("variants", {}).get("thumbnail", {}).get("url")
                or photo_dict.get("variants", {}).get("small", {}).get("url")
                or photo_dict.get("original_url")
            )
        responses.append(ProjectResponse.model_validate(resp))
    return responses


@router.get("/technologies", response_model=list[str])
async def list_distinct_technologies(db: AsyncSession = _session_dependency):
    """Return a distinct, sorted list of technologies across all projects."""

    result = await db.execute(select(ProjectModel.technologies))
    tech_strings = [row[0] for row in result.all() if row[0]]

    techs_set: set[str] = set()
    for s in tech_strings:
        # Prefer JSON arrays; fallback to comma-separated
        try:
            arr = json.loads(s)
            if isinstance(arr, list):
                for t in arr:
                    if isinstance(t, str):
                        cleaned = t.strip()
                        if cleaned:
                            techs_set.add(cleaned)
                continue
        except json.JSONDecodeError:
            # Fallback to comma-separated parsing below
            ...

        for t in s.split(","):
            cleaned = t.strip()
            if cleaned:
                techs_set.add(cleaned)

    return sorted(techs_set, key=lambda x: x.lower())


@router.get("/stats/summary")
async def get_project_stats(
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Get project statistics (admin only)."""
    total_projects = await get_project_count(db)
    featured_projects = len(await get_projects(db, featured_only=True))

    return {"total_projects": total_projects, "featured_projects": featured_projects}


@router.post("/repository/validate")
async def validate_repository_url(
    request: dict,
    current_user=_current_admin_user_dependency,
):
    """Validate a repository URL and return repository info (admin only)."""
    repository_url = request.get("repository_url")
    if not repository_url:
        raise HTTPException(status_code=400, detail="repository_url is required")

    repo_info = repository_service.parse_repository_url(repository_url)
    if not repo_info:
        raise HTTPException(status_code=400, detail="Invalid repository URL")

    is_valid = await repository_service.validate_repository(repo_info)
    if not is_valid:
        raise HTTPException(
            status_code=404, detail="Repository not found or not accessible"
        )

    return {
        "type": repo_info.type,
        "owner": repo_info.owner,
        "name": repo_info.name,
        "url": repo_info.url,
        "valid": True,
    }


@router.post("/preview-readme", response_model=ProjectPreviewResponse)
async def preview_readme(request: dict, current_user=_current_admin_user_dependency):
    """Fetch README content directly from a repository URL (admin only)."""
    repo_url = request.get("repo_url")
    if not repo_url:
        raise HTTPException(status_code=400, detail="repo_url is required")

    repo_info = repository_service.parse_repository_url(repo_url)
    if not repo_info:
        raise HTTPException(status_code=400, detail="Invalid repository URL")

    content, last_updated = await repository_service.fetch_readme(repo_info)
    if not content:
        raise HTTPException(status_code=404, detail="README not found")

    return ProjectPreviewResponse(
        content=content,
        repo_url=repo_url,
        raw_url=None,
        last_updated=last_updated,
        source=repo_info.type,
    )


@router.get("/{project_identifier}", response_model=ProjectResponse)
async def get_project_detail(
    project_identifier: str, db: AsyncSession = _session_dependency
):
    """Get project by ID or slug."""
    project = None

    # Try to parse as UUID first
    try:
        project_id = UUID(project_identifier)
        project = await get_project(db, project_id)
    except ValueError:
        # If not a valid UUID, treat as slug
        project = await get_project_by_slug(db, project_identifier)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    resp = ProjectResponse.model_validate(project).model_dump()
    images = await list_project_images(db, project.id)
    if images:
        img_dict = ProjectImageResponse.model_validate(images[0]).model_dump()
        photo_dict = img_dict.get("photo") or {}
        _populate_photo_urls(photo_dict)
        resp["cover_image_url"] = (
            photo_dict.get("variants", {}).get("thumbnail", {}).get("url")
            or photo_dict.get("variants", {}).get("small", {}).get("url")
            or photo_dict.get("original_url")
        )
    return ProjectResponse.model_validate(resp)


@router.post("/reorder")
async def reorder_projects(
    payload: ProjectReorderRequest,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Bulk reorder projects (admin only)."""
    items = [{"id": it.id, "order": it.order} for it in payload.items]
    await bulk_reorder_projects(db, items, normalize=payload.normalize)
    return {"message": "Reordered successfully"}


# Project images endpoints
@router.get("/{project_id}/images", response_model=list[ProjectImageResponse])
async def get_project_images(project_id: UUID, db: AsyncSession = _session_dependency):
    images = await list_project_images(db, project_id)
    payload = []
    for img in images:
        img_dict = ProjectImageResponse.model_validate(img).model_dump()
        photo_dict = img_dict.get("photo") or {}
        _populate_photo_urls(photo_dict)
        img_dict["photo"] = photo_dict
        payload.append(ProjectImageResponse.model_validate(img_dict))
    return payload


@router.post("/{project_id}/images", response_model=ProjectImageResponse)
async def add_project_image(
    project_id: UUID,
    payload: ProjectImageAttach,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    # Enforce hard limit of 10 images per project
    count_res = await db.execute(
        select(func.count())
        .select_from(ProjectImage)
        .where(ProjectImage.project_id == project_id)
    )
    if (count_res.scalar() or 0) >= MAX_PROJECT_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum images per project is {MAX_PROJECT_IMAGES}",
        )

    pi = await attach_project_image(
        db,
        project_id=project_id,
        photo_id=UUID(payload.photo_id),
        title=payload.title,
        alt_text=payload.alt_text,
    )
    # Eager-load photo for URL population
    images = await list_project_images(db, project_id)
    match = next((x for x in images if x.id == pi.id), None)
    if not match:
        return ProjectImageResponse.model_validate(pi)
    img_dict = ProjectImageResponse.model_validate(match).model_dump()
    photo_dict = img_dict.get("photo") or {}
    _populate_photo_urls(photo_dict)
    img_dict["photo"] = photo_dict
    return ProjectImageResponse.model_validate(img_dict)


@router.delete("/images/{project_image_id}")
async def delete_project_image(
    project_image_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    ok = await remove_project_image(db, project_image_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Project image not found")
    return {"message": "Deleted"}


@router.post("/{project_id}/images/reorder")
async def reorder_images(
    project_id: UUID,
    payload: ProjectImageReorderRequest,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    items = [{"id": it.id, "order": it.order} for it in payload.items]
    await reorder_project_images(db, project_id, items, normalize=payload.normalize)
    return {"message": "Reordered"}


@router.post("", response_model=ProjectResponse)
async def create_project_endpoint(
    project: ProjectCreate,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Create a new project (admin only)."""
    try:
        db_project = await create_project(db, project)
        return ProjectResponse.model_validate(db_project)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error creating project: {e!s}"
        ) from e


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project_endpoint(
    project_id: UUID,
    project_update: ProjectUpdate,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Update project (admin only)."""
    project = await update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}")
async def delete_project_endpoint(
    project_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Delete project (admin only)."""
    success = await delete_project_and_media(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"message": "Project deleted successfully"}


@router.get("/{project_identifier}/readme", response_model=ReadmeResponse)
async def get_project_readme(
    project_identifier: str,
    *,
    refresh: bool = False,
    db: AsyncSession = _session_dependency,
):
    """Get project README content."""
    project = None

    # Try to parse as UUID first
    try:
        project_id = UUID(project_identifier)
        project = await get_project(db, project_id)
    except ValueError:
        # If not a valid UUID, treat as slug
        project = await get_project_by_slug(db, project_identifier)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # If project doesn't use README from repository, return description
    if not project.use_readme:
        return ReadmeResponse(
            content=project.description,
            source=None,
            last_updated=project.updated_at,
        )

    # Check if we have cached README and don't need refresh
    if not refresh and project.readme_content:
        source = project.repository_type if project.repository_type else None
        return ReadmeResponse(
            content=project.readme_content,
            source=source,
            last_updated=project.readme_last_updated,
        )

    # Fetch fresh README from repository
    if project.repository_type and project.repository_owner and project.repository_name:
        repo_info = RepositoryInfo(
            type=project.repository_type,
            owner=project.repository_owner,
            name=project.repository_name,
            url=project.github_url or "",
        )

        readme_content, last_updated = await repository_service.fetch_readme(repo_info)

        if readme_content:
            # Update cached README in database
            await update_project_readme(db, project.id, readme_content, last_updated)

            return ReadmeResponse(
                content=readme_content,
                source=project.repository_type,
                last_updated=last_updated,
            )

    # Fallback to project description
    return ReadmeResponse(
        content=project.description,
        source=None,
        last_updated=project.updated_at,
    )
