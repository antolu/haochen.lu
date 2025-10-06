from __future__ import annotations

import jwt
from fastapi import Depends, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email_utils import is_email
from app.crud.user import get_user_by_username
from app.database import get_session
from app.models.user import User
from app.users import current_active_user, current_superuser

# Module-level singletons for dependency injection
_session_dependency = Depends(get_session)
_current_user_dependency = Depends(current_active_user)
_current_superuser_dependency = Depends(current_superuser)
_current_admin_user_dependency = Depends(current_superuser)  # Alias for compatibility


# Export fastapi-users dependencies
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

    try:
        token = auth_header.split(" ")[1]
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])

        # fastapi-users uses 'sub' for user ID
        user_id_or_email: str | None = payload.get("sub")
        if user_id_or_email is None:
            return None

        # Try to get user by email (fastapi-users default) or username
        if is_email(user_id_or_email):
            return await get_user_by_username(db, username=user_id_or_email)
        return await get_user_by_username(db, username=user_id_or_email)
    except Exception:
        return None


# Additional module-level singletons for common dependencies
_current_user_optional_dependency = Depends(get_current_user_optional)

# Common File and Form dependencies
_image_file_dependency = File(..., description="Image file to upload")
_profile_image_file_dependency = File(..., description="Square image file to upload")
_form_dependency = Form()
