from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import TokenManager
from app.core.security import decode_token
from app.crud.user import get_user_by_id
from app.database import get_session
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/refresh")

# Module-level dependency objects to avoid calling Depends() in function defaults
_token_dependency = Depends(oauth2_scheme)
_session_dependency = Depends(get_session)
# Deliberately create _current_user_dependency after current_active_user is defined
_current_user_dependency = Depends(lambda: None)  # placeholder; redefined below


async def current_active_user(
    token: str = _token_dependency,
    session: AsyncSession = _session_dependency,
) -> User:
    payload = decode_token(token, expected_type="access")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    jti = payload.get("jti")
    if isinstance(jti, str) and await TokenManager.is_access_token_blocked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = await get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return user


# Now that current_active_user is defined, set proper dependency
_current_user_dependency = Depends(current_active_user)


def current_superuser(user: User = _current_user_dependency) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges",
        )
    return user
