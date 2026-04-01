from __future__ import annotations

from uuid import UUID

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.application import (
    bulk_reorder_applications,
    create_application,
    delete_application,
    get_application,
    get_application_by_slug,
    get_application_count,
    get_applications,
    regenerate_application_credentials,
    update_application,
)
from app.dependencies import (
    _current_admin_user_dependency,
    _current_user_dependency,
    _session_dependency,
)
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationPublicListResponse,
    ApplicationPublicResponse,
    ApplicationReorderRequest,
    ApplicationResponse,
    ApplicationUpdate,
)

router = APIRouter()


@router.get("/")
async def list_applications(
    *, db: AsyncSession = _session_dependency
) -> ApplicationPublicListResponse:
    """List available applications for public access."""
    applications = await get_applications(db, enabled_only=True, admin_only=False)

    return ApplicationPublicListResponse(
        applications=[
            ApplicationPublicResponse.model_validate(app) for app in applications
        ],
        total=len(applications),
    )


@router.get("/authenticated")
async def list_authenticated_applications(
    *,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_user_dependency,
) -> ApplicationPublicListResponse:
    """List applications available to authenticated users."""
    admin_only = None if current_user.is_admin else False

    applications = await get_applications(db, enabled_only=True, admin_only=admin_only)

    return ApplicationPublicListResponse(
        applications=[
            ApplicationPublicResponse.model_validate(app) for app in applications
        ],
        total=len(applications),
    )


@router.get("/admin")
async def list_all_applications(
    *,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> ApplicationListResponse:
    """List all applications (admin only)."""
    applications = await get_applications(db, enabled_only=False, admin_only=None)

    return ApplicationListResponse(
        applications=[ApplicationResponse.model_validate(app) for app in applications],
        total=len(applications),
    )


@router.get("/{application_identifier}")
async def get_application_detail(
    application_identifier: str, db: AsyncSession = _session_dependency
) -> ApplicationResponse:
    """Get application by ID or slug."""
    application = None

    try:
        application_id = UUID(application_identifier)
        application = await get_application(db, application_id)
    except ValueError:
        application = await get_application_by_slug(db, application_identifier)

    if not application or not application.enabled:
        raise HTTPException(status_code=404, detail="Application not found")

    return ApplicationResponse.model_validate(application)


@router.post("")
async def create_application_endpoint(
    application: ApplicationCreate,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> ApplicationResponse:
    """Create a new application (admin only)."""
    try:
        db_application = await create_application(db, application)
        return ApplicationResponse.model_validate(db_application)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error creating application: {e!s}"
        ) from e


@router.put("/{application_id}")
async def update_application_endpoint(
    application_id: UUID,
    application_update: ApplicationUpdate,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> ApplicationResponse:
    """Update application (admin only)."""
    application = await update_application(db, application_id, application_update)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    return ApplicationResponse.model_validate(application)


@router.post("/{application_id}/regenerate-credentials")
async def regenerate_credentials(
    application_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> ApplicationResponse:
    """Regenerate client ID and secret for an application (admin only)."""
    application = await regenerate_application_credentials(db, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return ApplicationResponse.model_validate(application)


@router.post("/reorder")
async def reorder_applications(
    payload: ApplicationReorderRequest,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> dict[str, str]:
    """Bulk reorder applications (admin only)."""
    items: list[dict[str, str | int]] = [
        {"id": str(i.id), "order": i.order} for i in payload.items
    ]
    await bulk_reorder_applications(db, items, normalize=payload.normalize)
    return {"message": "Reordered successfully"}


@router.delete("/{application_id}")
async def delete_application_endpoint(
    application_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> dict[str, str]:
    """Delete application (admin only)."""
    success = await delete_application(db, application_id)
    if not success:
        raise HTTPException(status_code=404, detail="Application not found")

    return {"message": "Application deleted successfully"}


@router.get("/{application_id}/export")
async def export_application(
    application_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> Response:
    """Export application as YAML config (admin only)."""
    application = await get_application(db, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    config: dict = {
        "meta": {
            "name": application.name,
            "slug": application.slug,
            "description": application.description or "",
        },
        "ui": {
            "icon": application.icon or "",
            "color": application.color or "#3B82F6",
        },
        "integration": {
            "url": application.url,
            "admin_url": application.admin_url or "",
            "is_external": application.is_external,
            "requires_auth": application.requires_auth,
            "admin_only": application.admin_only,
            "menu_order": application.order,
            "has_admin": bool(application.admin_url),
        },
    }

    if application.requires_auth:
        config["oidc"] = {
            "client_id": application.client_id or "",
            "client_secret": application.client_secret or "",
            "redirect_uris": application.redirect_uris or "",
        }

    content = yaml.dump(
        config, default_flow_style=False, allow_unicode=True, sort_keys=False
    )
    return Response(
        content=content,
        media_type="application/x-yaml",
        headers={
            "Content-Disposition": f'attachment; filename="{application.slug}.yml"'
        },
    )


@router.get("/stats/summary")
async def get_application_stats(
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> dict[str, int]:
    """Get application statistics (admin only)."""
    total_applications = await get_application_count(db)
    enabled_applications = len(await get_applications(db, enabled_only=True))

    return {
        "total_applications": total_applications,
        "enabled_applications": enabled_applications,
        "disabled_applications": total_applications - enabled_applications,
    }
