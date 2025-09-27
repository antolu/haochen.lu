from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.redis import TokenManager as RedisTokenManager
from app.core.security import TokenManager, verify_password
from app.crud.user import create_admin_user, get_user_by_username
from app.database import get_session
from app.dependencies import get_current_user
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter()

# Module-level dependency variables to avoid B008
db_dependency = Depends(get_session)
current_user_dependency = Depends(get_current_user)


@router.post("/login", response_model=TokenResponse)
async def login(
    login_request: LoginRequest,
    response: Response,
    db: AsyncSession = db_dependency,
):
    """Login with enhanced session persistence"""
    # Get user from database
    user = await get_user_by_username(db, username=login_request.username)

    # If user doesn't exist and it's admin, create admin user
    if not user and login_request.username == "admin":
        user = await create_admin_user(
            db, username="admin", password=settings.admin_password
        )

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Username not found"
        )

    # Verify password using bcrypt
    if not verify_password(login_request.password, str(user.hashed_password)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password"
        )

    # Create tokens
    user_data = {"sub": user.username, "user_id": str(user.id)}

    access_token = TokenManager.create_access_token(user_data)
    refresh_token = TokenManager.create_refresh_token(
        user_data, remember_me=login_request.remember_me
    )

    # Store refresh token in Redis for revocation
    refresh_payload = TokenManager.verify_refresh_token(refresh_token)
    if refresh_payload:
        jti = refresh_payload.get("jti")
        if jti and isinstance(jti, str):
            if login_request.remember_me:
                expires_in = settings.refresh_token_expire_days * 24 * 60 * 60
            else:
                expires_in = settings.refresh_token_expire_minutes * 60

            await RedisTokenManager.store_refresh_token(str(user.id), jti, expires_in)

    # Set HttpOnly refresh token cookie
    TokenManager.set_refresh_cookie(
        response, refresh_token, remember_me=login_request.remember_me
    )

    user_response = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",  # nosec B106 - not a password, standard OAuth2 token type
        expires_in=settings.access_token_expire_minutes * 60,
        user=user_response,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    db: AsyncSession = db_dependency,
    refresh_token: str = Cookie(None, alias=settings.refresh_cookie_name),
):
    """Refresh access token using HttpOnly cookie"""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token missing"
        )

    # Verify refresh token
    payload = TokenManager.verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user_id = payload.get("user_id")
    jti = payload.get("jti")
    payload.get("remember_me", False)

    if not user_id or not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    # Check if token is revoked in Redis
    is_valid = await RedisTokenManager.is_refresh_token_valid(user_id, jti)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked"
        )

    # Get user from database
    username = payload.get("sub")
    if not username or not isinstance(username, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    user = await get_user_by_username(db, username=username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    # Create new access token
    user_data = {"sub": user.username, "user_id": str(user.id)}
    access_token = TokenManager.create_access_token(user_data)

    user_response = UserResponse.model_validate(user)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",  # nosec B106 - not a password, standard OAuth2 token type
        expires_in=settings.access_token_expire_minutes * 60,
        user=user_response,
    )


@router.post("/logout")
async def logout(
    response: Response,
    current_user=current_user_dependency,
    refresh_token: str = Cookie(None, alias=settings.refresh_cookie_name),
):
    """Logout and revoke current refresh token"""
    # Clear refresh token cookie
    TokenManager.clear_refresh_cookie(response)

    # Revoke refresh token in Redis if present
    if refresh_token:
        payload = TokenManager.verify_refresh_token(refresh_token)
        if payload:
            user_id = payload.get("user_id")
            jti = payload.get("jti")
            if user_id and jti:
                await RedisTokenManager.revoke_refresh_token(user_id, jti)

    return {"message": "Successfully logged out"}


@router.post("/revoke-all-sessions")
async def revoke_all_sessions(response: Response, current_user=current_user_dependency):
    """Logout everywhere - revoke all refresh tokens for the user"""
    user_id = str(current_user.id)

    # Revoke all refresh tokens for this user
    revoked_count = await RedisTokenManager.revoke_all_user_tokens(user_id)

    # Clear refresh token cookie
    TokenManager.clear_refresh_cookie(response)

    return {
        "message": "Successfully logged out from all devices",
        "revoked_sessions": revoked_count,
    }


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user=current_user_dependency):
    """Get current user information"""
    return UserResponse.model_validate(current_user)
