from __future__ import annotations

import typing

from arcadia_auth import DiscoveryError, JwksError, TokenExpiredError, TokenInvalidError
from fastapi import Depends, File, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.oidc import oidc_validator
from app.core.redis import TokenManager
from app.core.runtime_settings import SystemConfigService
from app.crud.user import get_user_by_oidc_id
from app.database import get_session
from app.models.user import User
from app.users import current_active_user, current_superuser

# Module-level singletons for dependency injection
_session_dependency = Depends(get_session)
_current_user_dependency = Depends(current_active_user)
_current_superuser_dependency = Depends(current_superuser)


# Export dependencies
get_current_user = current_active_user
get_current_admin_user = current_superuser


async def get_current_user_optional(
    request: Request,
    db: AsyncSession = _session_dependency,
) -> User | None:
    """Get current user if authenticated, otherwise return None."""
    # Try to get authorization header
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        payload = await oidc_validator.validate_token(token)
    except (TokenExpiredError, TokenInvalidError, JwksError, DiscoveryError):
        return None
    jti = payload.get("jti")
    if isinstance(jti, str) and await TokenManager.is_access_token_blocked(jti):
        return None
    oidc_id = payload.get("sub")
    if not isinstance(oidc_id, str):
        return None
    return await get_user_by_oidc_id(db, oidc_id=oidc_id)


def get_config_service(request: Request) -> SystemConfigService:
    return typing.cast(SystemConfigService, request.app.state.config_service)


# Additional module-level singletons for common dependencies
_current_user_optional_dependency = Depends(get_current_user_optional)

# Common File dependencies
_image_file_dependency = File(..., description="Image file to upload")
_profile_image_file_dependency = File(..., description="Square image file to upload")
