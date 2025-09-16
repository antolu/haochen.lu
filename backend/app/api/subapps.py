from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.subapp import (
    create_subapp,
    delete_subapp,
    get_subapp,
    get_subapp_by_slug,
    get_subapp_count,
    get_subapps,
    update_subapp,
)
from app.database import get_session
from app.dependencies import get_current_admin_user, get_current_user
from app.schemas.subapp import (
    SubAppCreate,
    SubAppUpdate,
)

router = APIRouter()


def convert_to_response(db_subapp) -> dict:
    """Convert a database SubApp model to response dict."""
    return {
        "id": str(db_subapp.id),
        "slug": db_subapp.slug,
        "name": db_subapp.name,
        "description": db_subapp.description,
        "icon": db_subapp.icon,
        "color": db_subapp.color,
        "url": db_subapp.url,
        "is_external": db_subapp.is_external,
        "requires_auth": db_subapp.requires_auth,
        "admin_only": db_subapp.admin_only,
        "show_in_menu": db_subapp.show_in_menu,
        "enabled": db_subapp.enabled,
        "order": db_subapp.order,
        "created_at": db_subapp.created_at.isoformat()
        if db_subapp.created_at
        else None,
        "updated_at": db_subapp.updated_at.isoformat()
        if db_subapp.updated_at
        else None,
    }


@router.get(
    "/",
)
async def list_subapps(menu_only: bool = True, db: AsyncSession = Depends(get_session)):
    """List available sub-applications for public access."""
    # Show only public subapps (those that don't require auth)
    subapps = await get_subapps(
        db, enabled_only=True, menu_only=menu_only, admin_only=False
    )

    # Filter out auth-required apps
    public_subapps = [app for app in subapps if not app.requires_auth]

    total = len(public_subapps)

    return {
        "subapps": [convert_to_response(app) for app in public_subapps],
        "total": total,
    }


@router.get(
    "/authenticated",
)
async def list_authenticated_subapps(
    menu_only: bool = True,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """List sub-applications available to authenticated users."""
    admin_only = None if current_user.is_admin else False

    subapps = await get_subapps(
        db, enabled_only=True, menu_only=menu_only, admin_only=admin_only
    )

    total = len(subapps)

    return {"subapps": [convert_to_response(app) for app in subapps], "total": total}


@router.get(
    "/admin",
)
async def list_all_subapps(
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """List all sub-applications (admin only)."""
    subapps = await get_subapps(db, enabled_only=False, menu_only=False)

    total = await get_subapp_count(db)

    return {"subapps": [convert_to_response(app) for app in subapps], "total": total}


@router.get(
    "/{subapp_identifier}",
)
async def get_subapp_detail(
    subapp_identifier: str, db: AsyncSession = Depends(get_session)
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

    return convert_to_response(subapp)


@router.post("/")
async def create_subapp_endpoint(
    subapp: SubAppCreate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Create a new sub-application (admin only)."""
    try:
        db_subapp = await create_subapp(db, subapp)
        return convert_to_response(db_subapp)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error creating sub-application: {str(e)}"
        ) from e


@router.put(
    "/{subapp_id}",
)
async def update_subapp_endpoint(
    subapp_id: UUID,
    subapp_update: SubAppUpdate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Update sub-application (admin only)."""
    subapp = await update_subapp(db, subapp_id, subapp_update)
    if not subapp:
        raise HTTPException(status_code=404, detail="Sub-application not found")

    return convert_to_response(subapp)


@router.delete("/{subapp_id}")
async def delete_subapp_endpoint(
    subapp_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Delete sub-application (admin only)."""
    success = await delete_subapp(db, subapp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sub-application not found")

    return {"message": "Sub-application deleted successfully"}


@router.get("/stats/summary")
async def get_subapp_stats(
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Get sub-application statistics (admin only)."""
    total_subapps = await get_subapp_count(db)
    enabled_subapps = len(await get_subapps(db, enabled_only=True, menu_only=False))

    return {
        "total_subapps": total_subapps,
        "enabled_subapps": enabled_subapps,
        "disabled_subapps": total_subapps - enabled_subapps,
    }
