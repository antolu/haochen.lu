from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi_users.password import PasswordHelper
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email_utils import is_email
from app.crud.user import get_user_by_email, get_user_by_username
from app.database import get_session
from app.users import auth_backend

router = APIRouter()

# Module-level singletons for dependency injection
_session_dependency = Depends(get_session)


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),  # noqa: B008
    session: AsyncSession = _session_dependency,
) -> dict[str, str]:
    """Custom login endpoint that accepts username or email."""
    # Check if the input is an email or username
    if is_email(form_data.username):
        user = await get_user_by_email(session, form_data.username)
    else:
        user = await get_user_by_username(session, form_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )

    # Verify password
    password_helper = PasswordHelper()
    verified, _updated_password_hash = password_helper.verify_and_update(
        form_data.password, user.hashed_password
    )

    if not verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_USER_NOT_VERIFIED",
        )

    # Generate token
    # We ignore the type here because fastapi-users strategy writing is sometimes complex for mypy
    strategy = auth_backend.get_strategy()
    token = await strategy.write_token(user)

    return {"access_token": token, "token_type": "bearer"}  # nosec B105
