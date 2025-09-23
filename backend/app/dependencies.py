from __future__ import annotations

from fastapi import Depends, File, Form, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.crud.user import get_user_by_username
from app.database import get_session
from app.models.user import User

security = HTTPBearer()

# Module-level singletons for dependency injection
_security_dependency = Depends(security)
_session_dependency = Depends(get_session)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = _security_dependency,
    db: AsyncSession = _session_dependency,
) -> User:
    invalid_token_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(credentials.credentials)
    if payload is None:
        raise invalid_token_exception

    username: str | None = payload.get("sub")
    if username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await get_user_by_username(db, username=username)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


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
        payload = decode_token(token)
        if payload is None:
            return None

        username: str | None = payload.get("sub")
        if username is None:
            return None

        return await get_user_by_username(db, username=username)
    except Exception:
        return None


# Additional module-level singletons for common dependencies
_current_user_dependency = Depends(get_current_user)
_current_user_optional_dependency = Depends(get_current_user_optional)


def get_current_admin_user(
    current_user: User = _current_user_dependency,
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges required",
        )
    return current_user


_current_admin_user_dependency = Depends(get_current_admin_user)


# Common File and Form dependencies
_image_file_dependency = File(..., description="Image file to upload")
_profile_image_file_dependency = File(..., description="Square image file to upload")
_form_dependency = Form()
