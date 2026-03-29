from __future__ import annotations

import hmac
import json
import logging
import secrets
import typing
from base64 import urlsafe_b64encode
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.oidc import oidc_validator
from app.core.redis import TokenManager, redis_client
from app.core.security import (
    create_access_token,
)
from app.crud.application import get_application_by_client_id, get_application_by_slug
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
AUTH_CODE_TTL_SECONDS = 300


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


def _validate_app_redirect_uri(registered: str | None, redirect_uri: str) -> None:
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


def _encode_app_state(next_url: typing.Any) -> str:
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
    result: dict[str, str] = {str(k): str(v) for k, v in payload.items()}
    return result


async def _fetch_oidc_tokens(code: str) -> dict[str, typing.Any]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{settings.oidc_endpoint}/api/oidc/token",
            data={
                "grant_type": "authorization_code",
                "client_id": settings.oidc_client_id,
                "client_secret": settings.oidc_client_secret,
                "code": code,
                "redirect_uri": settings.oidc_redirect_uri,
            },
        )

    if response.status_code != status.HTTP_200_OK:
        logger.error("OIDC token exchange failed: %s", response.text)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication failed",
        )

    data: dict[str, typing.Any] = response.json()
    access_token = data.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC token missing",
        )
    return data


async def _fetch_oidc_profile(access_token: str) -> dict[str, object]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Authelia OIDC userinfo endpoint is typically /api/oidc/userinfo
        response = await client.get(
            f"{settings.oidc_endpoint}/api/oidc/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code != status.HTTP_200_OK:
        logger.error("OIDC userinfo fetch failed: %s", response.text)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication failed",
        )

    payload = response.json()
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OIDC profile",
        )
    return payload


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
    is_admin = isinstance(groups, list) and "admins" in groups

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
    client_id: str | None = None,
    redirect_uri: str | None = None,
    response_type: str | None = None,
    state: str | None = None,
    session: AsyncSession = _session_dependency,
) -> RedirectResponse | AuthorizeResponse:
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
        app = await get_application_by_client_id(session, client_id)
        if app is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid client_id",
            )
        _validate_app_redirect_uri(app.redirect_uris, redirect_uri)

    state_token = await _store_login_state(context)
    query = urlencode({
        "client_id": settings.oidc_client_id,
        "response_type": "code",
        "redirect_uri": settings.oidc_redirect_uri,
        "scope": "openid profile email groups",
        "state": state_token,
    })
    url = f"{settings.oidc_public_endpoint}/api/oidc/authorization?{query}"

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
    oidc_tokens = await _fetch_oidc_tokens(code)
    oidc_profile = await _fetch_oidc_profile(oidc_tokens["access_token"])
    user = await _sync_user(session, oidc_profile)
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
    _set_refresh_cookie(response, refresh_token, max_age=cookie_ttl)
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
    old_refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if not old_refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
        )

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_response = await client.post(
            f"{settings.oidc_endpoint}/api/oidc/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": old_refresh_token,
                "client_id": settings.oidc_client_id,
                "client_secret": settings.oidc_client_secret,
            },
        )

    if token_response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked"
        )

    token_data = token_response.json()
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

    # Revoke refresh token at Authelia (best-effort)
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if refresh_token:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{settings.oidc_endpoint}/api/oidc/revocation",
                    data={
                        "token": refresh_token,
                        "client_id": settings.oidc_client_id,
                        "client_secret": settings.oidc_client_secret,
                    },
                )
        except Exception:
            logger.debug("Authelia revocation request failed (ignored)")

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

    app = await get_application_by_client_id(session, client_id)
    if app is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid client_id"
        )

    _validate_app_redirect_uri(app.redirect_uris, redirect_uri)
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

    app = await get_application_by_client_id(session, request.client_id)
    if app is None or not hmac.compare_digest(
        app.client_secret or "", request.client_secret
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_client"
        )

    _validate_app_redirect_uri(app.redirect_uris, request.redirect_uri)
    auth_code_payload = await _consume_authorization_code(request.code)
    if not hmac.compare_digest(
        auth_code_payload.get("client_id") or "", request.client_id
    ) or not hmac.compare_digest(
        auth_code_payload.get("redirect_uri") or "", request.redirect_uri
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


@router.get("/jump/{application_slug}", response_model=AuthorizeResponse)
async def jump_to_application(
    application_slug: str,
    target: str = "app",
    session: AsyncSession = _session_dependency,
    user: User = _current_user_dependency,
) -> AuthorizeResponse:
    application = await get_application_by_slug(session, application_slug)
    if application is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Application not found"
        )

    redirect_uris = _parse_redirect_uris(application.redirect_uris)
    if not redirect_uris:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application redirect URI not configured",
        )
    if not application.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application client credentials not configured",
        )

    if target not in {"app", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid jump target",
        )
    if target == "admin" and not application.admin_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application admin URL not configured",
        )

    redirect_uri = redirect_uris[0]
    destination = application.admin_url if target == "admin" else application.url
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application destination not configured",
        )

    state = _encode_app_state(destination)
    auth_code = await _store_authorization_code(
        user_id=str(user.id),
        client_id=str(application.client_id),
        redirect_uri=redirect_uri,
    )
    return AuthorizeResponse(url=f"{redirect_uri}?code={auth_code}&state={state}")
