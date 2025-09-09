from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_admin_user
from app.crud.project import (
    get_projects,
    get_project_count,
    get_project,
    get_project_by_slug,
    create_project,
    update_project,
    delete_project
)
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse

router = APIRouter()


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    featured_only: bool = False,
    status: str | None = None,
    db: AsyncSession = Depends(get_session)
):
    """List all projects."""
    projects = await get_projects(
        db,
        featured_only=featured_only,
        status=status
    )
    
    total = await get_project_count(db)
    
    return ProjectListResponse(
        projects=[ProjectResponse.model_validate(project) for project in projects],
        total=total
    )


@router.get("/featured", response_model=list[ProjectResponse])
async def list_featured_projects(
    db: AsyncSession = Depends(get_session)
):
    """Get featured projects."""
    projects = await get_projects(db, featured_only=True)
    return [ProjectResponse.model_validate(project) for project in projects]


@router.get("/{project_identifier}", response_model=ProjectResponse)
async def get_project_detail(
    project_identifier: str,
    db: AsyncSession = Depends(get_session)
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
    current_user = Depends(get_current_admin_user)
):
    """Create a new project (admin only)."""
    try:
        db_project = await create_project(db, project)
        return ProjectResponse.model_validate(db_project)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error creating project: {str(e)}"
        )


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project_endpoint(
    project_id: UUID,
    project_update: ProjectUpdate,
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
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
    current_user = Depends(get_current_admin_user)
):
    """Delete project (admin only)."""
    success = await delete_project(db, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted successfully"}


@router.get("/stats/summary")
async def get_project_stats(
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """Get project statistics (admin only)."""
    total_projects = await get_project_count(db)
    featured_projects = len(await get_projects(db, featured_only=True))
    
    return {
        "total_projects": total_projects,
        "featured_projects": featured_projects
    }