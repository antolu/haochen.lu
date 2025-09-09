from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.dependencies import get_current_admin_user, get_current_user
from app.crud.subapp import (
    get_subapps,
    get_subapp_count,
    get_subapp,
    get_subapp_by_slug,
    create_subapp,
    update_subapp,
    delete_subapp
)
from app.schemas.subapp import SubAppCreate, SubAppUpdate, SubAppResponse, SubAppListResponse

router = APIRouter()


@router.get("/", response_model=SubAppListResponse)
async def list_subapps(
    menu_only: bool = True,
    db: AsyncSession = Depends(get_session)
):
    """List available sub-applications for public access."""
    # Show only public subapps (those that don't require auth)
    subapps = await get_subapps(
        db,
        enabled_only=True,
        menu_only=menu_only,
        admin_only=False
    )
    
    # Filter out auth-required apps
    public_subapps = [app for app in subapps if not app.requires_auth]
    
    total = len(public_subapps)
    
    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in public_subapps],
        total=total
    )


@router.get("/authenticated", response_model=SubAppListResponse)
async def list_authenticated_subapps(
    menu_only: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_user)
):
    """List sub-applications available to authenticated users."""
    admin_only = None if current_user.is_admin else False
    
    subapps = await get_subapps(
        db,
        enabled_only=True,
        menu_only=menu_only,
        admin_only=admin_only
    )
    
    total = len(subapps)
    
    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in subapps],
        total=total
    )


@router.get("/admin", response_model=SubAppListResponse)
async def list_all_subapps(
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """List all sub-applications (admin only)."""
    subapps = await get_subapps(
        db,
        enabled_only=False,
        menu_only=False
    )
    
    total = await get_subapp_count(db)
    
    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in subapps],
        total=total
    )


@router.get("/{subapp_identifier}", response_model=SubAppResponse)
async def get_subapp_detail(
    subapp_identifier: str,
    db: AsyncSession = Depends(get_session)
):
    """Get sub-application by ID or slug."""
    subapp = None
    
    # Try to parse as UUID first
    try:
        subapp_id = UUID(subapp_identifier)
        subapp = await get_subapp(db, subapp_id)
    except ValueError:
        # If not a valid UUID, treat as slug
        subapp = await get_subapp_by_slug(db, subapp_identifier)
    
    if not subapp or not subapp.enabled:
        raise HTTPException(status_code=404, detail="Sub-application not found")
    
    return SubAppResponse.model_validate(subapp)


@router.post("/", response_model=SubAppResponse)
async def create_subapp_endpoint(
    subapp: SubAppCreate,
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """Create a new sub-application (admin only)."""
    try:
        db_subapp = await create_subapp(db, subapp)
        return SubAppResponse.model_validate(db_subapp)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error creating sub-application: {str(e)}"
        )


@router.put("/{subapp_id}", response_model=SubAppResponse)
async def update_subapp_endpoint(
    subapp_id: UUID,
    subapp_update: SubAppUpdate,
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """Update sub-application (admin only)."""
    subapp = await update_subapp(db, subapp_id, subapp_update)
    if not subapp:
        raise HTTPException(status_code=404, detail="Sub-application not found")
    
    return SubAppResponse.model_validate(subapp)


@router.delete("/{subapp_id}")
async def delete_subapp_endpoint(
    subapp_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """Delete sub-application (admin only)."""
    success = await delete_subapp(db, subapp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sub-application not found")
    
    return {"message": "Sub-application deleted successfully"}


@router.get("/stats/summary")
async def get_subapp_stats(
    db: AsyncSession = Depends(get_session),
    current_user = Depends(get_current_admin_user)
):
    """Get sub-application statistics (admin only)."""
    total_subapps = await get_subapp_count(db)
    enabled_subapps = len(await get_subapps(db, enabled_only=True, menu_only=False))
    
    return {
        "total_subapps": total_subapps,
        "enabled_subapps": enabled_subapps,
        "disabled_subapps": total_subapps - enabled_subapps
    }