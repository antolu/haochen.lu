from __future__ import annotations

import json
import secrets
import typing
from base64 import urlsafe_b64encode
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.redis import TokenManager, redis_client
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.crud.subapp import get_subapp_by_client_id, get_subapp_by_slug
from app.crud.user import (
    create_user,
    get_user_by_casdoor_id,
    get_user_by_id,
    update_user,
)
from app.database import get_session
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.users import current_active_user

router = APIRouter()

_session_dependency = Depends(get_session)
_current_user_dependency = Depends(current_active_user)

LOGIN_STATE_TTL_SECONDS = 600
AUTH_CODE_TTL_SECONDS = 300


class LoginUrlResponse(BaseModel):
    url: str


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserRead | None = None


class OAuthTokenRequest(BaseModel):
    grant_type: str
    code: str
    client_id: str
    client_secret: str
    redirect_uri: str


class AuthorizeResponse(BaseModel):
    url: str


class SessionContext(BaseModel):
    next: str = "/admin"
    client_id: str | None = None
    redirect_uri: str | None = None
    response_type: str | None = None
    state: str | None = None

    model_config = ConfigDict(extra="forbid")


def _refresh_token_ttl_seconds() -> int:
    return settings.refresh_token_expire_days * 24 * 60 * 60


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=_refresh_token_ttl_seconds(),
        httponly=settings.cookie_httponly,
        secure=settings.cookie_secure,
        # mypy's Response.set_cookie expects Literal['lax','strict','none'] | None
        # settings.cookie_samesite is a string validated in Settings; cast to Any
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


def _parse_redirect_uris(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass
    return [
        item.strip() for item in value.replace("\n", ",").split(",") if item.strip()
    ]


def _validate_subapp_redirect_uri(registered: str | None, redirect_uri: str) -> None:
    allowed = _parse_redirect_uris(registered)
    if redirect_uri not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid redirect_uri",
        )


def _relative_target(url: str) -> str:
    parsed = urlparse(url)
    target = parsed.path or "/"
    if parsed.query:
        target = f"{target}?{parsed.query}"
    return target


def _encode_subapp_state(next_url: typing.Any) -> str:
    # next_url may be a SQLAlchemy Column at type-check time; coerce to str
    url_str = str(next_url)
    payload = json.dumps({"next": _relative_target(url_str)}, separators=(",", ":"))
    return urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8").rstrip("=")


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


async def _store_authorization_code(
    *,
    user_id: str,
    client_id: str,
    redirect_uri: str,
) -> str:
    auth_code = secrets.token_urlsafe(32)
    payload = json.dumps({
        "user_id": user_id,
        "client_id": client_id,
        "redirect_uri": redirect_uri,
    })
    saved = await redis_client.setex(
        f"auth_code:{auth_code}", AUTH_CODE_TTL_SECONDS, payload
    )
    if not saved:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authorization storage unavailable",
        )
    return auth_code


async def _consume_authorization_code(code: str) -> dict[str, str]:
    key = f"auth_code:{code}"
    value = await redis_client.get(key)
    await redis_client.delete(key)
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_grant"
        )
    payload = json.loads(value)
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_grant"
        )
    # Ensure keys and values are strings
    result: dict[str, str] = {str(k): str(v) for k, v in payload.items()}
    return result


async def _fetch_casdoor_token(code: str) -> str:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.casdoor_endpoint}/api/login/oauth/access_token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.casdoor_client_id,
                "client_secret": settings.casdoor_client_secret,
                "code": code,
                "redirect_uri": settings.casdoor_redirect_uri,
            },
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange Casdoor code",
        )

    access_token = response.json().get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Casdoor token missing",
        )
    return access_token


async def _fetch_casdoor_profile(access_token: str) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            f"{settings.casdoor_endpoint}/api/userinfo",
            params={"access_token": access_token},
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch Casdoor profile",
        )

    payload = response.json()
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Casdoor profile",
        )
    return payload


async def _sync_user(session: AsyncSession, casdoor_profile: dict[str, object]) -> User:
    casdoor_id = str(casdoor_profile.get("sub") or casdoor_profile.get("id") or "")
    email = str(casdoor_profile.get("email") or "")
    username = str(
        casdoor_profile.get("preferred_username")
        or casdoor_profile.get("name")
        or casdoor_profile.get("displayName")
        or email.split("@", maxsplit=1)[0]
        or casdoor_id
    )
    roles = casdoor_profile.get("roles") or []
    is_admin = bool(casdoor_profile.get("isAdmin")) or (
        isinstance(roles, list) and "admin" in roles
    )

    if not casdoor_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Casdoor profile missing required fields",
        )

    existing_user = await get_user_by_casdoor_id(session, casdoor_id)
    if existing_user is None:
        return await create_user(
            session,
            UserCreate(
                casdoor_id=casdoor_id,
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


async def _issue_session_tokens(user: User) -> tuple[str, str, str]:
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    refresh_payload = decode_token(refresh_token, expected_type="refresh")
    if refresh_payload is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create refresh token",
        )

    refresh_jti = refresh_payload.get("jti")
    if not isinstance(refresh_jti, str):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Invalid refresh token",
        )

    stored = await TokenManager.store_refresh_token(
        str(user.id),
        refresh_jti,
        _refresh_token_ttl_seconds(),
    )
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Session storage unavailable",
        )

    return access_token, refresh_token, refresh_jti


@router.get("/login", response_model=LoginUrlResponse)
async def login_redirect(
    next_path: str = Query("/admin", alias="next"),
    client_id: str | None = None,
    redirect_uri: str | None = None,
    response_type: str | None = None,
    state: str | None = None,
    session: AsyncSession = _session_dependency,
) -> LoginUrlResponse:
    context = SessionContext(
        next=_normalize_next(next_path),
        client_id=client_id,
        redirect_uri=redirect_uri,
        response_type=response_type,
        state=state,
    )

    if client_id or redirect_uri or response_type or state:
        if response_type != "code":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported response_type",
            )
        if not client_id or not redirect_uri or not state:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing OAuth parameters",
            )
        subapp = await get_subapp_by_client_id(session, client_id)
        if subapp is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client_id",
            )
        _validate_subapp_redirect_uri(subapp.redirect_uris, redirect_uri)

    state_token = await _store_login_state(context)
    query = urlencode({
        "client_id": settings.casdoor_client_id,
        "response_type": "code",
        "redirect_uri": settings.casdoor_redirect_uri,
        "scope": "openid profile email",
        "state": state_token,
    })
    return LoginUrlResponse(
        url=f"{settings.casdoor_endpoint}/login/oauth/authorize?{query}"
    )


@router.get("/callback")
async def auth_callback(
    code: str,
    state: str,
    session: AsyncSession = _session_dependency,
) -> Response:
    context = await _consume_login_state(state)
    casdoor_access_token = await _fetch_casdoor_token(code)
    casdoor_profile = await _fetch_casdoor_profile(casdoor_access_token)
    user = await _sync_user(session, casdoor_profile)
    _, refresh_token, _ = await _issue_session_tokens(user)

    redirect_target = context.next
    if context.client_id and context.redirect_uri and context.state:
        auth_code = await _store_authorization_code(
            user_id=str(user.id),
            client_id=context.client_id,
            redirect_uri=context.redirect_uri,
        )
        redirect_target = (
            f"{context.redirect_uri}?code={auth_code}&state={context.state}"
        )

    response = Response(status_code=status.HTTP_302_FOUND)
    response.headers["Location"] = redirect_target
    _set_refresh_cookie(response, refresh_token)
    return response


@router.get("/me", response_model=UserRead)
async def get_me(user: User = _current_user_dependency) -> UserRead:
    return UserRead.model_validate(user)


@router.post("/refresh", response_model=OAuthTokenResponse)
async def refresh_session(
    request: Request,
    response: Response,
    session: AsyncSession = _session_dependency,
) -> OAuthTokenResponse:
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    payload = decode_token(refresh_token, expected_type="refresh")
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    user_id = payload.get("sub")
    jti = payload.get("jti")
    if not isinstance(user_id, str) or not isinstance(jti, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    is_valid = await TokenManager.is_refresh_token_valid(user_id, jti)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked"
        )

    user = await get_user_by_id(session, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )

    access_token = create_access_token({"sub": str(user.id)})
    rotated_refresh_token = create_refresh_token({"sub": str(user.id)})
    rotated_payload = decode_token(rotated_refresh_token, expected_type="refresh")
    if rotated_payload is None or not isinstance(rotated_payload.get("jti"), str):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rotate refresh token",
        )

    await TokenManager.revoke_refresh_token(user_id, jti)
    await TokenManager.store_refresh_token(
        user_id,
        rotated_payload["jti"],
        _refresh_token_ttl_seconds(),
    )
    _set_refresh_cookie(response, rotated_refresh_token)

    return OAuthTokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    user: User = _current_user_dependency,
) -> dict[str, str]:
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    payload = decode_token(refresh_token, expected_type="refresh")
    if payload is not None and isinstance(payload.get("jti"), str):
        await TokenManager.revoke_refresh_token(str(user.id), payload["jti"])
    _clear_refresh_cookie(response)
    return {"message": "Logged out"}


@router.post("/revoke-all-sessions")
async def revoke_all_sessions(
    response: Response,
    user: User = _current_user_dependency,
) -> dict[str, str]:
    await TokenManager.revoke_all_user_tokens(str(user.id))
    _clear_refresh_cookie(response)
    return {"message": "All sessions revoked"}


@router.get("/authorize", response_model=AuthorizeResponse)
async def authorize(
    client_id: str,
    redirect_uri: str,
    response_type: str,
    state: str,
    user: User = _current_user_dependency,
    session: AsyncSession = _session_dependency,
) -> AuthorizeResponse:
    if response_type != "code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported response_type",
        )

    subapp = await get_subapp_by_client_id(session, client_id)
    if subapp is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid client_id"
        )

    _validate_subapp_redirect_uri(subapp.redirect_uris, redirect_uri)
    auth_code = await _store_authorization_code(
        user_id=str(user.id),
        client_id=client_id,
        redirect_uri=redirect_uri,
    )
    return AuthorizeResponse(url=f"{redirect_uri}?code={auth_code}&state={state}")


@router.post("/oauth/token", response_model=OAuthTokenResponse)
async def oauth_token(
    request: OAuthTokenRequest,
    session: AsyncSession = _session_dependency,
) -> OAuthTokenResponse:
    if request.grant_type != "authorization_code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="unsupported_grant_type",
        )

    subapp = await get_subapp_by_client_id(session, request.client_id)
    if subapp is None or subapp.client_secret != request.client_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_client"
        )

    _validate_subapp_redirect_uri(subapp.redirect_uris, request.redirect_uri)
    auth_code_payload = await _consume_authorization_code(request.code)
    if (
        auth_code_payload.get("client_id") != request.client_id
        or auth_code_payload.get("redirect_uri") != request.redirect_uri
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_grant"
        )

    user = await get_user_by_id(session, auth_code_payload["user_id"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_grant"
        )

    return OAuthTokenResponse(
        access_token=create_access_token({"sub": str(user.id)}),
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserRead.model_validate(user),
    )


@router.get("/jump/{subapp_slug}", response_model=AuthorizeResponse)
async def jump_to_subapp(
    subapp_slug: str,
    target: str = "app",
    session: AsyncSession = _session_dependency,
    user: User = _current_user_dependency,
) -> AuthorizeResponse:
    subapp = await get_subapp_by_slug(session, subapp_slug)
    if subapp is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="SubApp not found"
        )

    redirect_uris = _parse_redirect_uris(subapp.redirect_uris)
    if not redirect_uris:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SubApp redirect URI not configured",
        )
    if not subapp.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SubApp client credentials not configured",
        )

    if target not in {"app", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid jump target",
        )
    if target == "admin" and not subapp.admin_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SubApp admin URL not configured",
        )

    redirect_uri = redirect_uris[0]
    destination = subapp.admin_url if target == "admin" else subapp.url
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SubApp destination not configured",
        )

    state = _encode_subapp_state(destination)
    auth_code = await _store_authorization_code(
        user_id=str(user.id),
        client_id=str(subapp.client_id),
        redirect_uri=redirect_uri,
    )
    return AuthorizeResponse(url=f"{redirect_uri}?code={auth_code}&state={state}")
