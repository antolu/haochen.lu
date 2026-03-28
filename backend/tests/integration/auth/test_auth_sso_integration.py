from __future__ import annotations

import asyncio
from urllib.parse import parse_qs, urlparse

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from tests.factories import SubAppFactory

from app.api import auth as auth_api
from app.api.auth import _issue_session_tokens
from app.core.security import create_access_token, decode_token
from app.models.user import User


@pytest.mark.integration
@pytest.mark.auth
async def test_callback_creates_local_session_and_redirects(
    async_client: AsyncClient,
    test_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_fetch_token(code: str) -> str:
        await asyncio.sleep(0)
        assert code == "oidc-code"
        return "oidc-access-token"

    async def fake_fetch_profile(access_token: str) -> dict[str, object]:
        await asyncio.sleep(0)
        assert access_token == "oidc-access-token"
        return {
            "sub": "oidc-user-1",
            "email": "sso@example.com",
            "preferred_username": "sso-user",
            "groups": ["admins"],
        }

    monkeypatch.setattr(auth_api, "_fetch_oidc_token", fake_fetch_token)
    monkeypatch.setattr(auth_api, "_fetch_oidc_profile", fake_fetch_profile)

    login_response = await async_client.get(
        "/api/auth/login",
        params={"next": "/admin"},
        headers={"Accept": "application/json"},
    )
    state = parse_qs(urlparse(login_response.json()["url"]).query)["state"][0]

    response = await async_client.get(
        "/api/auth/callback",
        params={"code": "oidc-code", "state": state},
        follow_redirects=False,
    )

    assert response.status_code == 302
    assert response.headers["location"] == "/admin"
    assert response.cookies.get("refresh_token")

    result = await test_session.execute(
        select(User).where(User.oidc_id == "oidc-user-1")
    )
    user = result.scalar_one()
    assert user.email == "sso@example.com"
    assert user.is_admin is True


@pytest.mark.integration
@pytest.mark.auth
async def test_callback_redirects_back_to_first_party_subapp(
    async_client: AsyncClient,
    test_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await SubAppFactory.create_async(
        test_session,
        slug="moviedb",
        client_id="moviedb-client",
        client_secret="moviedb-secret",
        redirect_uris="http://localhost:6001/auth/callback",
        url="http://localhost:6001",
        admin_url="http://localhost:6001/admin",
    )

    async def fake_fetch_token(code: str) -> str:
        await asyncio.sleep(0)
        assert code == "oidc-code"
        return "oidc-access-token"

    async def fake_fetch_profile(access_token: str) -> dict[str, object]:
        await asyncio.sleep(0)
        assert access_token == "oidc-access-token"
        return {
            "sub": "oidc-user-2",
            "email": "moviedb@example.com",
            "preferred_username": "moviedb-user",
            "groups": [],
        }

    monkeypatch.setattr(auth_api, "_fetch_oidc_token", fake_fetch_token)
    monkeypatch.setattr(auth_api, "_fetch_oidc_profile", fake_fetch_profile)

    login_response = await async_client.get(
        "/api/auth/login",
        params={
            "client_id": "moviedb-client",
            "redirect_uri": "http://localhost:6001/auth/callback",
            "response_type": "code",
            "state": "moviedb-state",
        },
        headers={"Accept": "application/json"},
    )
    state = parse_qs(urlparse(login_response.json()["url"]).query)["state"][0]

    callback_response = await async_client.get(
        "/api/auth/callback",
        params={"code": "oidc-code", "state": state},
        follow_redirects=False,
    )

    assert callback_response.status_code == 302
    parsed_redirect = urlparse(callback_response.headers["location"])
    redirect_query = parse_qs(parsed_redirect.query)
    assert parsed_redirect.scheme == "http"
    assert parsed_redirect.netloc == "localhost:6001"
    assert parsed_redirect.path == "/auth/callback"
    assert redirect_query["state"] == ["moviedb-state"]
    assert "code" in redirect_query


@pytest.mark.integration
@pytest.mark.auth
async def test_authorize_validates_redirect_uri(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        client_id="client-1",
        client_secret="secret-1",
        redirect_uris="https://sub.example.com/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    response = await async_client.get(
        "/api/auth/authorize",
        params={
            "client_id": subapp.client_id,
            "redirect_uri": "https://evil.example.com/callback",
            "response_type": "code",
            "state": "state-1",
        },
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid redirect_uri"


@pytest.mark.integration
@pytest.mark.auth
async def test_authorize_and_token_exchange_flow(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        client_id="client-2",
        client_secret="secret-2",
        redirect_uris="https://sub.example.com/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    authorize_response = await async_client.get(
        "/api/auth/authorize",
        params={
            "client_id": subapp.client_id,
            "redirect_uri": "https://sub.example.com/callback",
            "response_type": "code",
            "state": "state-2",
        },
        headers=headers,
    )

    assert authorize_response.status_code == 200
    redirect_url = authorize_response.json()["url"]
    code = parse_qs(urlparse(redirect_url).query)["code"][0]

    token_response = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": subapp.client_id,
            "client_secret": subapp.client_secret,
            "redirect_uri": "https://sub.example.com/callback",
        },
    )

    assert token_response.status_code == 200
    payload = decode_token(
        token_response.json()["access_token"], expected_type="access"
    )
    assert payload is not None
    assert payload["sub"] == str(admin_user.id)


@pytest.mark.integration
@pytest.mark.auth
async def test_mock_first_party_subapp_contract_flow(
    async_client: AsyncClient,
    test_session: AsyncSession,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    await SubAppFactory.create_async(
        test_session,
        slug="mock-subapp",
        url="http://mock-subapp.local",
        admin_url="http://mock-subapp.local/admin",
        client_id="mock-client",
        client_secret="mock-secret",
        redirect_uris="http://mock-subapp.local/auth/callback",
    )

    async def fake_fetch_token(code: str) -> str:
        await asyncio.sleep(0)
        assert code == "oidc-code"
        return "oidc-access-token"

    async def fake_fetch_profile(access_token: str) -> dict[str, object]:
        await asyncio.sleep(0)
        assert access_token == "oidc-access-token"
        return {
            "sub": "oidc-subapp-user",
            "email": "subapp@example.com",
            "preferred_username": "subapp-user",
            "groups": ["admins"],
        }

    monkeypatch.setattr(auth_api, "_fetch_oidc_token", fake_fetch_token)
    monkeypatch.setattr(auth_api, "_fetch_oidc_profile", fake_fetch_profile)

    login_response = await async_client.get(
        "/api/auth/login",
        params={
            "client_id": "mock-client",
            "redirect_uri": "http://mock-subapp.local/auth/callback",
            "response_type": "code",
            "state": "mock-state",
        },
        headers={"Accept": "application/json"},
    )
    authelia_state = parse_qs(urlparse(login_response.json()["url"]).query)["state"][0]

    callback_response = await async_client.get(
        "/api/auth/callback",
        params={"code": "oidc-code", "state": authelia_state},
        follow_redirects=False,
    )

    assert callback_response.status_code == 302
    parsed_redirect = urlparse(callback_response.headers["location"])
    redirect_query = parse_qs(parsed_redirect.query)
    assert parsed_redirect.scheme == "http"
    assert parsed_redirect.netloc == "mock-subapp.local"
    assert parsed_redirect.path == "/auth/callback"
    assert redirect_query["state"] == ["mock-state"]
    code = redirect_query["code"][0]

    token_response = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": "mock-client",
            "client_secret": "mock-secret",
            "redirect_uri": "http://mock-subapp.local/auth/callback",
        },
    )

    assert token_response.status_code == 200
    access_token = token_response.json()["access_token"]
    me_response = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )

    assert me_response.status_code == 200
    body = me_response.json()
    assert body["email"] == "subapp@example.com"
    assert body["is_admin"] is True


@pytest.mark.integration
@pytest.mark.auth
async def test_refresh_rotates_refresh_cookie(
    async_client: AsyncClient,
    admin_user: User,
) -> None:
    _access_token, refresh_token, _ = await _issue_session_tokens(admin_user)
    async_client.cookies.set("refresh_token", refresh_token)

    response = await async_client.post("/api/auth/refresh")

    assert response.status_code == 200
    assert response.cookies.get("refresh_token")
    payload = decode_token(response.json()["access_token"], expected_type="access")
    assert payload is not None
    assert payload["sub"] == str(admin_user.id)


@pytest.mark.integration
@pytest.mark.auth
async def test_admin_jump_uses_admin_url_state(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        slug="moviedb",
        url="https://moviedb.example.com",
        admin_url="https://moviedb.example.com/admin",
        client_id="client-admin",
        client_secret="secret-admin",
        redirect_uris="https://moviedb.example.com/auth/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    response = await async_client.get(
        f"/api/auth/jump/{subapp.slug}",
        params={"target": "admin"},
        headers=headers,
    )

    assert response.status_code == 200
    redirect_url = response.json()["url"]
    assert redirect_url.startswith("https://moviedb.example.com/auth/callback?code=")
    assert "state=" in redirect_url


@pytest.mark.integration
@pytest.mark.auth
async def test_mock_subapp_rejects_wrong_client_secret(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        client_id="client-wrong-secret",
        client_secret="expected-secret",
        redirect_uris="http://mock-subapp.local/auth/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    authorize_response = await async_client.get(
        "/api/auth/authorize",
        params={
            "client_id": subapp.client_id,
            "redirect_uri": "http://mock-subapp.local/auth/callback",
            "response_type": "code",
            "state": "secret-state",
        },
        headers=headers,
    )
    code = parse_qs(urlparse(authorize_response.json()["url"]).query)["code"][0]

    token_response = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": subapp.client_id,
            "client_secret": "wrong-secret",
            "redirect_uri": "http://mock-subapp.local/auth/callback",
        },
    )

    assert token_response.status_code == 401
    assert token_response.json()["detail"] == "invalid_client"


@pytest.mark.integration
@pytest.mark.auth
async def test_mock_subapp_rejects_reused_code(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        client_id="client-reuse",
        client_secret="reuse-secret",
        redirect_uris="http://mock-subapp.local/auth/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    authorize_response = await async_client.get(
        "/api/auth/authorize",
        params={
            "client_id": subapp.client_id,
            "redirect_uri": "http://mock-subapp.local/auth/callback",
            "response_type": "code",
            "state": "reuse-state",
        },
        headers=headers,
    )
    code = parse_qs(urlparse(authorize_response.json()["url"]).query)["code"][0]

    first_exchange = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": subapp.client_id,
            "client_secret": subapp.client_secret,
            "redirect_uri": "http://mock-subapp.local/auth/callback",
        },
    )
    assert first_exchange.status_code == 200

    second_exchange = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": subapp.client_id,
            "client_secret": subapp.client_secret,
            "redirect_uri": "http://mock-subapp.local/auth/callback",
        },
    )

    assert second_exchange.status_code == 400
    assert second_exchange.json()["detail"] == "invalid_grant"


@pytest.mark.integration
@pytest.mark.auth
async def test_mock_subapp_rejects_mismatched_redirect_uri(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        client_id="client-redirect",
        client_secret="redirect-secret",
        redirect_uris="http://mock-subapp.local/auth/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    authorize_response = await async_client.get(
        "/api/auth/authorize",
        params={
            "client_id": subapp.client_id,
            "redirect_uri": "http://mock-subapp.local/auth/callback",
            "response_type": "code",
            "state": "redirect-state",
        },
        headers=headers,
    )
    code = parse_qs(urlparse(authorize_response.json()["url"]).query)["code"][0]

    token_response = await async_client.post(
        "/api/auth/oauth/token",
        json={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": subapp.client_id,
            "client_secret": subapp.client_secret,
            "redirect_uri": "http://mock-subapp.local/other-callback",
        },
    )

    assert token_response.status_code == 400
    assert token_response.json()["detail"] == "Invalid redirect_uri"


@pytest.mark.integration
@pytest.mark.auth
async def test_admin_jump_requires_admin_url(
    async_client: AsyncClient,
    test_session: AsyncSession,
    admin_user: User,
) -> None:
    subapp = await SubAppFactory.create_async(
        test_session,
        slug="no-admin-url",
        url="http://mock-subapp.local",
        admin_url=None,
        client_id="client-no-admin",
        client_secret="secret-no-admin",
        redirect_uris="http://mock-subapp.local/auth/callback",
    )
    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"
    }

    response = await async_client.get(
        f"/api/auth/jump/{subapp.slug}",
        params={"target": "admin"},
        headers=headers,
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Application admin URL not configured"
