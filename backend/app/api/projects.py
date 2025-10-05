from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.file_access import file_access_controller
from app.core.file_validation import file_validator
from app.core.image_processor import image_processor
from app.core.repository_service import RepositoryInfo, repository_service
from app.crud.project import (
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
    _current_user_optional_dependency,
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
from app.types.access_control import FileType

router = APIRouter()


def _populate_project_image_urls(project_image_id: str, photo_like: dict) -> dict:
    """Populate secure API URLs for project image file access."""
    if not photo_like:
        return photo_like
    photo_like["original_url"] = f"/api/projects/images/{project_image_id}/file"
    photo_like["download_url"] = f"/api/projects/images/{project_image_id}/download"
    variants = photo_like.get("variants")
    if isinstance(variants, dict):
        for variant_name, variant_data in variants.items():
            if isinstance(variant_data, dict):
                variant_data.setdefault(
                    "url",
                    f"/api/projects/images/{project_image_id}/file/{variant_name}",
                )
                for fmt_data in variant_data.values():
                    if isinstance(fmt_data, dict) and "filename" in fmt_data:
                        fmt_data["url"] = (
                            f"/api/projects/images/{project_image_id}/file/{variant_name}"
                        )
    return photo_like


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
            first = images[0]
            photo_like = {
                "variants": first.variants or {},
                "original_url": first.original_path,
            }
            _populate_project_image_urls(str(first.id), photo_like)
            variants: dict = {}
            if isinstance(photo_like.get("variants"), dict):
                variants = photo_like.get("variants")  # type: ignore[assignment]
            resp["cover_image_url"] = (
                variants.get("medium", {}).get("url")
                or variants.get("large", {}).get("url")
                or variants.get("small", {}).get("url")
                or photo_like.get("original_url")
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
            first = images[0]
            photo_like = {
                "variants": first.variants or {},
                "original_url": first.original_path,
            }
            _populate_project_image_urls(str(first.id), photo_like)
            variants: dict = {}
            if isinstance(photo_like.get("variants"), dict):
                variants = photo_like.get("variants")  # type: ignore[assignment]
            resp["cover_image_url"] = (
                variants.get("medium", {}).get("url")
                or variants.get("large", {}).get("url")
                or variants.get("small", {}).get("url")
                or photo_like.get("original_url")
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
        first = images[0]
        photo_like = {
            "variants": first.variants or {},
            "original_url": first.original_path,
        }
        _populate_project_image_urls(str(first.id), photo_like)
        variants: dict = {}
        if isinstance(photo_like.get("variants"), dict):
            variants = photo_like.get("variants")  # type: ignore[assignment]
        resp["cover_image_url"] = (
            variants.get("medium", {}).get("url")
            or variants.get("large", {}).get("url")
            or variants.get("small", {}).get("url")
            or photo_like.get("original_url")
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
    payload: list[ProjectImageResponse] = []
    for img in images:
        base = ProjectImageResponse.model_validate(img).model_dump()
        photo_like = {
            "id": str(img.id),
            "variants": img.variants or {},
            "original_url": img.original_path,
        }
        base_photo = _populate_project_image_urls(str(img.id), photo_like)
        base["photo"] = base_photo
        payload.append(ProjectImageResponse.model_validate(base))
    return payload


@router.post("/{project_id}/images", response_model=ProjectImageResponse)
async def add_project_image(
    project_id: UUID,
    payload: ProjectImageAttach,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    # Enforce hard limit of images per project
    count_res = await db.execute(
        select(func.count())
        .select_from(ProjectImage)
        .where(ProjectImage.project_id == project_id)
    )
    if (count_res.scalar() or 0) >= settings.max_project_images:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum images per project is {settings.max_project_images}",
        )

    # Deprecated path: attaching existing photos is no longer supported.
    raise HTTPException(
        status_code=410,
        detail="Attaching existing photos is deprecated. Use /images/upload",
    )


@router.post("/{project_id}/images/upload", response_model=ProjectImageResponse)
async def upload_project_image(
    project_id: UUID,
    file: UploadFile,
    title: str = Form(""),
    alt_text: str = Form(""),
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Upload a new image directly to a project (separate from photos)."""
    # Validate file type using magic number detection
    await file_validator.validate_image_file(file)

    count_res = await db.execute(
        select(func.count())
        .select_from(ProjectImage)
        .where(ProjectImage.project_id == project_id)
    )
    if (count_res.scalar() or 0) >= settings.max_project_images:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum images per project is {settings.max_project_images}",
        )

    # Process image via shared processor
    try:
        processed = await image_processor.process_image(
            file.file, file.filename or "image.jpg", title or file.filename
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {e!s}"
        ) from e

    # Persist into project_images directly
    pi = ProjectImage(
        project_id=project_id,
        filename=processed.get("filename"),
        original_path=processed.get("original_path"),
        variants=processed.get("variants"),
        title=title or None,
        alt_text=alt_text or None,
    )
    db.add(pi)
    await db.commit()
    await db.refresh(pi)

    # Shape response with URLs
    img_dict = ProjectImageResponse.model_validate(pi).model_dump()
    photo_like = {
        "id": str(pi.id),  # Use the project image ID as the photo ID for direct uploads
        "variants": processed.get("variants", {}),
        "original_url": processed.get("original_path"),
    }
    img_dict["photo"] = _populate_project_image_urls(str(pi.id), photo_like)
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


# Secure file serving for project images (no direct /uploads exposure)
@router.get("/images/{project_image_id}/file")
async def serve_project_image_original(
    project_image_id: UUID,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: object | None = _current_user_optional_dependency,
):
    res = await db.execute(
        select(ProjectImage).where(ProjectImage.id == project_image_id)
    )
    pi = res.scalar_one_or_none()
    if not pi:
        raise HTTPException(status_code=404, detail="Project image not found")

    # Build a photo-like object
    class _PL:
        def __init__(self, original_path, variants):
            self.original_path = original_path
            self.variants = variants or {}

    file_path = file_access_controller.get_file_path(
        _PL(pi.original_path, pi.variants), FileType.ORIGINAL
    )
    content_type = file_access_controller.get_content_type(file_path)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/images/{project_image_id}/file/{variant}")
async def serve_project_image_variant(
    project_image_id: UUID,
    variant: str,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: object | None = _current_user_optional_dependency,
):
    res = await db.execute(
        select(ProjectImage).where(ProjectImage.id == project_image_id)
    )
    pi = res.scalar_one_or_none()
    if not pi:
        raise HTTPException(status_code=404, detail="Project image not found")

    try:
        file_type = FileType(variant)
    except ValueError:
        # Accept bare size names; map to size-preferring any format
        if variant not in {"thumbnail", "small", "medium", "large", "xlarge"}:
            raise HTTPException(
                status_code=400, detail=f"Invalid variant '{variant}'"
            ) from None
        # Map bare size to the base enum (same value)
        file_type = getattr(FileType, variant.upper())  # type: ignore[arg-type]

    class _PL:
        def __init__(self, original_path, variants):
            self.original_path = original_path
            self.variants = variants or {}

    try:
        file_path = file_access_controller.get_file_path(
            _PL(pi.original_path, pi.variants), file_type
        )
    except HTTPException as e:
        if e.status_code == 404:
            # fallback to original
            file_path = file_access_controller.get_file_path(
                _PL(pi.original_path, pi.variants), FileType.ORIGINAL
            )
            file_type = FileType.ORIGINAL
        else:
            raise

    content_type = file_access_controller.get_content_type(file_path)
    cache_control = (
        "public, max-age=86400"
        if file_type in [FileType.THUMBNAIL, FileType.SMALL]
        else "private, max-age=3600"
    )
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": cache_control},
    )


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
