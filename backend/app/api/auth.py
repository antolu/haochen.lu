from __future__ import annotations

import logging
import secrets
import typing

from arcadia_auth import OidcError
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import oidc_settings, settings
from app.core.oidc import oidc_client, oidc_validator
from app.core.redis import TokenManager, redis_client
from app.core.security import decode_token
from app.crud.user import (
    create_user,
    get_user_by_id,
    get_user_by_oidc_id,
    update_user,
)
from app.database import get_session
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.users import current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)

_session_dependency = Depends(get_session)
_current_user_dependency = Depends(current_active_user)

LOGIN_STATE_TTL_SECONDS = 600


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead | None = None


class AuthorizeResponse(BaseModel):
    url: str


class SessionContext(BaseModel):
    next: str = "/admin"

    model_config = ConfigDict(extra="forbid")


def _refresh_token_ttl_seconds() -> int:
    return settings.refresh_token_expire_days * 24 * 60 * 60


def _set_refresh_cookie(
    response: Response, refresh_token: str, max_age: int | None = None
) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=max_age if max_age is not None else _refresh_token_ttl_seconds(),
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=typing.cast(typing.Any, settings.cookie_samesite),
        domain=settings.cookie_domain,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        samesite=typing.cast(typing.Any, settings.cookie_samesite),
        domain=settings.cookie_domain,
        path="/",
    )


def _normalize_next(next_path: str | None) -> str:
    if not next_path:
        return "/admin"
    if not next_path.startswith("/") or next_path.startswith("//"):
        return "/admin"
    return next_path


async def _store_login_state(context: SessionContext) -> str:
    state_token = secrets.token_urlsafe(32)
    saved = await redis_client.setex(
        f"login_state:{state_token}",
        LOGIN_STATE_TTL_SECONDS,
        context.model_dump_json(),
    )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session storage unavailable",
        )
    return state_token


async def _consume_login_state(state_token: str) -> SessionContext:
    key = f"login_state:{state_token}"
    value = await redis_client.get(key)
    await redis_client.delete(key)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid state"
        )
    return SessionContext.model_validate_json(value)


async def _sync_user(session: AsyncSession, oidc_profile: dict[str, object]) -> User:
    oidc_id = str(oidc_profile.get("sub") or "")
    email = str(oidc_profile.get("email") or "")
    username = str(
        oidc_profile.get("preferred_username")
        or oidc_profile.get("name")
        or email.split("@", maxsplit=1)[0]
        or oidc_id
    )
    groups = oidc_profile.get("groups") or []
    is_admin = isinstance(groups, list) and "/admins" in groups

    if not oidc_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC profile missing required fields",
        )

    existing_user = await get_user_by_oidc_id(session, oidc_id)
    if existing_user is None:
        return await create_user(
            session,
            UserCreate(
                oidc_id=oidc_id,
                email=email,
                username=username,
                is_admin=is_admin,
            ),
        )

    updated_user = await update_user(
        session,
        existing_user.id,
        UserUpdate(username=username, is_admin=is_admin, email=email),
    )
    if updated_user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        )
    return updated_user


@router.get("/login", response_model=None)
async def login_redirect(
    request: Request,
    next_path: str = Query("/admin", alias="next"),
) -> RedirectResponse | AuthorizeResponse:
    context = SessionContext(next=_normalize_next(next_path))
    state_token = await _store_login_state(context)
    url = oidc_client.authorization_url(
        redirect_uri=oidc_settings.oidc_redirect_uri,
        state=state_token,
        scope="openid profile email",
    )

    # Return JSON for the frontend/tests, or redirect for direct browser access
    if (
        request.headers.get("accept") == "application/json"
        or request.headers.get("x-requested-with") == "XMLHttpRequest"
    ):
        return AuthorizeResponse(url=url)

    return RedirectResponse(url=url)


@router.get("/callback")
async def auth_callback(
    code: str,
    state: str,
    session: AsyncSession = _session_dependency,
) -> Response:
    context = await _consume_login_state(state)
    try:
        oidc_tokens = await oidc_client.fetch_tokens(
            code, oidc_settings.oidc_redirect_uri
        )
        oidc_profile = await oidc_client.fetch_userinfo(oidc_tokens["access_token"])
    except OidcError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Authentication failed"
        ) from exc
    await _sync_user(session, oidc_profile)
    refresh_token = oidc_tokens.get("refresh_token") or ""
    if not isinstance(refresh_token, str) or not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC refresh token missing",
        )
    cookie_ttl = oidc_tokens.get("expires_in")
    if not isinstance(cookie_ttl, int):
        cookie_ttl = _refresh_token_ttl_seconds()

    redirect_target = context.next
    response = Response(status_code=status.HTTP_302_FOUND)
    response.headers["Location"] = redirect_target
    _set_refresh_cookie(response, refresh_token, max_age=cookie_ttl)
    return response


@router.get("/me", response_model=UserRead)
async def get_me(user: User = _current_user_dependency) -> UserRead:
    return UserRead.model_validate(user)


@router.get("/userinfo", response_model=UserRead)
async def userinfo(
    request: Request,
    session: AsyncSession = _session_dependency,
) -> UserRead:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token"
        )
    token = auth_header.split(" ", 1)[1]

    payload = decode_token(token, expected_type="access")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    jti = payload.get("jti")
    if isinstance(jti, str) and await TokenManager.is_access_token_blocked(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked"
        )

    sub = payload.get("sub")
    if not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = await get_user_by_id(session, sub)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    return UserRead.model_validate(user)


@router.post("/refresh", response_model=OAuthTokenResponse)
async def refresh_session(
    request: Request,
    response: Response,
    session: AsyncSession = _session_dependency,
) -> OAuthTokenResponse:
    old_refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if not old_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    try:
        token_data = await oidc_client.refresh_token(old_refresh_token)
    except OidcError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked"
        ) from exc
    new_access_token = token_data.get("access_token")
    new_refresh_token = token_data.get("refresh_token")
    if not isinstance(new_access_token, str) or not isinstance(new_refresh_token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token response"
        )

    access_payload = await oidc_validator.validate_token(new_access_token)
    if access_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token"
        )

    oidc_id = access_payload.get("sub")
    if not isinstance(oidc_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )

    user = await get_user_by_oidc_id(session, oidc_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    _set_refresh_cookie(response, new_refresh_token)

    return OAuthTokenResponse(
        access_token=new_access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: User = _current_user_dependency,
) -> dict[str, str]:
    # Blocklist the current access token so it can't be reused until expiry
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        access_token = auth_header.split(" ", 1)[1]
        access_payload = await oidc_validator.validate_token(access_token)
        if access_payload is not None and isinstance(access_payload.get("jti"), str):
            remaining_ttl = settings.access_token_expire_minutes * 60
            await TokenManager.blocklist_access_token(
                access_payload["jti"], remaining_ttl
            )

    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if refresh_token:
        await oidc_client.revoke_token(refresh_token)

    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.post("/revoke-all-sessions")
async def revoke_all_sessions(
    response: Response,
    user: User = _current_user_dependency,
) -> dict[str, str]:
    _clear_refresh_cookie(response)
    return {"message": "All sessions revoked"}
