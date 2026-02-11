from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
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
from app.dependencies import (
    _current_admin_user_dependency,
    _current_user_dependency,
    _session_dependency,
)
from app.models.user import User
from app.schemas.subapp import (
    SubAppCreate,
    SubAppListResponse,
    SubAppResponse,
    SubAppUpdate,
)

router = APIRouter()


@router.get("/")
async def list_subapps(
    *, menu_only: bool = True, db: AsyncSession = _session_dependency
) -> SubAppListResponse:
    """List available sub-applications for public access."""
    # Show only public subapps (those that don't require auth)
    subapps = await get_subapps(
        db, enabled_only=True, menu_only=menu_only, admin_only=False
    )

    # Filter out auth-required apps
    public_subapps = [app for app in subapps if not app.requires_auth]

    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in public_subapps],
        total=len(public_subapps),
    )


@router.get("/authenticated")
async def list_authenticated_subapps(
    *,
    menu_only: bool = True,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_user_dependency,
) -> SubAppListResponse:
    """List sub-applications available to authenticated users."""
    admin_only = None if current_user.is_admin else False

    subapps = await get_subapps(
        db, enabled_only=True, menu_only=menu_only, admin_only=admin_only
    )

    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in subapps],
        total=len(subapps),
    )


@router.get("/admin")
async def list_all_subapps(
    *,
    menu_only: bool = False,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> SubAppListResponse:
    """List all sub-applications (admin only)."""
    subapps = await get_subapps(
        db, enabled_only=False, menu_only=menu_only, admin_only=None
    )

    return SubAppListResponse(
        subapps=[SubAppResponse.model_validate(app) for app in subapps],
        total=len(subapps),
    )


@router.get("/{subapp_identifier}")
async def get_subapp_detail(
    subapp_identifier: str, db: AsyncSession = _session_dependency
) -> SubAppResponse:
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


@router.post("")
async def create_subapp_endpoint(
    subapp: SubAppCreate,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> SubAppResponse:
    """Create a new sub-application (admin only)."""
    try:
        db_subapp = await create_subapp(db, subapp)
        return SubAppResponse.model_validate(db_subapp)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error creating sub-application: {e!s}"
        ) from e


@router.put("/{subapp_id}")
async def update_subapp_endpoint(
    subapp_id: UUID,
    subapp_update: SubAppUpdate,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> SubAppResponse:
    """Update sub-application (admin only)."""
    subapp = await update_subapp(db, subapp_id, subapp_update)
    if not subapp:
        raise HTTPException(status_code=404, detail="Sub-application not found")

    return SubAppResponse.model_validate(subapp)


@router.delete("/{subapp_id}")
async def delete_subapp_endpoint(
    subapp_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> dict[str, str]:
    """Delete sub-application (admin only)."""
    success = await delete_subapp(db, subapp_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sub-application not found")

    return {"message": "Sub-application deleted successfully"}


@router.get("/stats/summary")
async def get_subapp_stats(
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> dict[str, int]:
    """Get sub-application statistics (admin only)."""
    total_subapps = await get_subapp_count(db)
    enabled_subapps = len(await get_subapps(db, enabled_only=True, menu_only=False))

    return {
        "total_subapps": total_subapps,
        "enabled_subapps": enabled_subapps,
        "disabled_subapps": total_subapps - enabled_subapps,
    }
