from __future__ import annotations

from urllib.parse import parse_qs, urlparse

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from tests.factories import UserFactory

from app.core.security import create_access_token
from app.models import User


@pytest.mark.integration
@pytest.mark.auth
async def test_login_returns_casdoor_authorize_url(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/auth/login", params={"next": "/admin"})

    assert response.status_code == status.HTTP_200_OK
    login_url = response.json()["url"]
    parsed = urlparse(login_url)
    query = parse_qs(parsed.query)

    assert parsed.path.endswith("/login/oauth/authorize")
    assert query["response_type"] == ["code"]
    assert query["scope"] == ["openid profile email"]
    assert query["state"]


@pytest.mark.integration
@pytest.mark.auth
async def test_login_rejects_invalid_oauth_parameters(
    async_client: AsyncClient,
) -> None:
    response = await async_client.get(
        "/api/auth/login",
        params={
            "client_id": "subapp-client",
            "redirect_uri": "https://sub.example.com/callback",
            "response_type": "token",
            "state": "state-1",
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["detail"] == "Unsupported response_type"


@pytest.mark.integration
@pytest.mark.auth
async def test_protected_endpoint_requires_token(async_client: AsyncClient) -> None:
    response = await async_client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
async def test_protected_endpoint_with_valid_token_succeeds(
    async_client: AsyncClient, admin_user: User
) -> None:
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    response = await async_client.get("/api/auth/me", headers=headers)

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == admin_user.email


@pytest.mark.integration
@pytest.mark.auth
async def test_logout_succeeds_with_valid_token_and_refresh_cookie(
    async_client: AsyncClient, admin_user: User
) -> None:
    # Avoid top-level import-time DB/IO by importing only the helper symbol
    # This import is allowed by our test style; keep it here intentionally.
    from app.api.auth import _issue_session_tokens  # noqa: PLC0415

    access_token, refresh_token, _ = await _issue_session_tokens(admin_user)
    async_client.cookies.set("refresh_token", refresh_token)

    response = await async_client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["message"] == "Logged out"


@pytest.mark.integration
@pytest.mark.auth
async def test_logout_without_token_returns_401(async_client: AsyncClient) -> None:
    response = await async_client.post("/api/auth/logout")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
async def test_invalid_authorization_header_format_returns_401(
    async_client: AsyncClient, admin_token: str
) -> None:
    invalid_headers = [
        {"Authorization": admin_token},
        {"Authorization": f"Token {admin_token}"},
        {"Authorization": "Bearer"},
        {"Authorization": f"Bearer {admin_token} extra"},
    ]

    for headers in invalid_headers:
        response = await async_client.get("/api/auth/me", headers=headers)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
async def test_expired_token_returns_401(
    async_client: AsyncClient, admin_user: User
) -> None:
    expired_token = create_access_token({"sub": str(admin_user.id)}, expires_delta=-1)

    response = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
async def test_tampered_token_returns_401(
    async_client: AsyncClient, admin_token: str
) -> None:
    tampered_token = admin_token[:-5] + "XXXXX"

    response = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
async def test_case_insensitive_bearer_scheme(
    async_client: AsyncClient, admin_token: str, admin_user: User
) -> None:
    schemes = ["Bearer", "bearer", "BEARER", "BeArEr"]

    for scheme in schemes:
        response = await async_client.get(
            "/api/auth/me",
            headers={"Authorization": f"{scheme} {admin_token}"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["username"] == admin_user.username


@pytest.mark.integration
@pytest.mark.auth
async def test_admin_only_endpoint_requires_admin_role(
    async_client: AsyncClient, test_session: AsyncSession
) -> None:
    regular_user = await UserFactory.create_async(test_session, is_admin=False)
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(regular_user.id)})}"
    }

    response = await async_client.get("/api/subapps/admin", headers=headers)

    assert response.status_code == status.HTTP_403_FORBIDDEN
