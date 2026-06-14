from __future__ import annotations

from arcadia_auth import DiscoveryError, JwksError, TokenExpiredError, TokenInvalidError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.oidc import oidc_validator
from app.core.redis import TokenManager
from app.crud.user import get_user_by_oidc_id
from app.database import get_session
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/refresh")

_token_dependency = Depends(oauth2_scheme)
_session_dependency = Depends(get_session)


async def current_active_user(
    token: str = _token_dependency,
    session: AsyncSession = _session_dependency,
) -> User:
    try:
        payload = await oidc_validator.validate_token(token)
    except (TokenExpiredError, TokenInvalidError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc
    except (JwksError, DiscoveryError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable",
        ) from exc

    jti = payload.get("jti")
    if isinstance(jti, str) and await TokenManager.is_access_token_blocked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    oidc_id = payload.get("sub")
    if not isinstance(oidc_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = await get_user_by_oidc_id(session, oidc_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return user


_current_user_dependency = Depends(current_active_user)


def current_superuser(user: User = _current_user_dependency) -> User:
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough privileges",
        )
    return user
