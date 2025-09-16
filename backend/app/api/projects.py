from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.repository_service import RepositoryInfo, repository_service
from app.crud.project import (
    create_project,
    delete_project,
    get_project,
    get_project_by_slug,
    get_project_count,
    get_projects,
    update_project,
    update_project_readme,
)
from app.database import get_session
from app.dependencies import get_current_admin_user
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
    ReadmeResponse,
)

router = APIRouter()


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    featured_only: bool = False,
    status: str | None = None,
    db: AsyncSession = Depends(get_session),
):
    """List all projects."""
    projects = await get_projects(db, featured_only=featured_only, status=status)

    total = await get_project_count(db)

    return ProjectListResponse(
        projects=[ProjectResponse.model_validate(project) for project in projects],
        total=total,
    )


@router.get("/featured", response_model=list[ProjectResponse])
async def list_featured_projects(db: AsyncSession = Depends(get_session)):
    """Get featured projects."""
    projects = await get_projects(db, featured_only=True)
    return [ProjectResponse.model_validate(project) for project in projects]


@router.get("/stats/summary")
async def get_project_stats(
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Get project statistics (admin only)."""
    total_projects = await get_project_count(db)
    featured_projects = len(await get_projects(db, featured_only=True))

    return {"total_projects": total_projects, "featured_projects": featured_projects}


@router.post("/repository/validate")
async def validate_repository_url(
    request: dict,
    current_user=Depends(get_current_admin_user),
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


@router.get("/{project_identifier}", response_model=ProjectResponse)
async def get_project_detail(
    project_identifier: str, db: AsyncSession = Depends(get_session)
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

    return ProjectResponse.model_validate(project)


@router.post("/", response_model=ProjectResponse)
async def create_project_endpoint(
    project: ProjectCreate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
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
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Update project (admin only)."""
    project = await update_project(db, project_id, project_update)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProjectResponse.model_validate(project)


@router.delete("/{project_id}")
async def delete_project_endpoint(
    project_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Delete project (admin only)."""
    success = await delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")

    return {"message": "Project deleted successfully"}


@router.get("/{project_identifier}/readme", response_model=ReadmeResponse)
async def get_project_readme(
    project_identifier: str,
    refresh: bool = False,
    db: AsyncSession = Depends(get_session),
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
