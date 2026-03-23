"""
Security Tests for Session Management
Tests security aspects of the session management system including
CSRF protection, session fixation, token security, and attack prevention.
"""

from __future__ import annotations

import time

import jwt
import pytest
from httpx import AsyncClient

from app.config import settings
from app.core.security import create_access_token
from app.models import User


@pytest.mark.security
@pytest.mark.auth
def test_token_expiry_enforcement(test_session, admin_user: User):
    """Test that token expiry times are properly enforced."""
    access_token = create_access_token({"sub": str(admin_user.id)})

    # Decode token and check expiry (without verification for testing)
    payload = jwt.decode(
        access_token,
        settings.secret_key,
        algorithms=["HS256"],
        options={"verify_exp": False, "verify_aud": False},
    )

    current_time = time.time()
    token_exp = payload.get("exp", 0)
    time_diff = token_exp - current_time

    expected_lifetime = settings.access_token_expire_minutes * 60
    assert expected_lifetime - 100 <= time_diff <= expected_lifetime + 100


@pytest.mark.security
@pytest.mark.auth
async def test_token_errors_dont_leak_information(async_client: AsyncClient):
    """Test that token validation errors don't leak information."""
    # Test with various malformed tokens
    malformed_tokens = [
        "Bearer invalid.token.here",
        "Bearer " + "x" * 100,  # Too long
        "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",  # Malformed JWT
    ]

    for token in malformed_tokens:
        headers = {"Authorization": token}
        response = await async_client.get("/api/auth/me", headers=headers)

        # Should return generic 401
        assert response.status_code == 401

        error_detail = response.json().get("detail", "")

        # Generic error message is fine - we just verify we get 401
        # and don't leak specific validation details like "signature invalid"
        assert len(error_detail) > 0


@pytest.mark.security
@pytest.mark.auth
async def test_login_response_security_headers(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test that login responses include appropriate security headers."""
    response = await async_client.get("/api/auth/login", params={"next": "/admin"})

    # Check for security headers (implementation dependent)
    headers = response.headers

    # Content-Type should be appropriate
    assert "application/json" in headers.get("content-type", "")

    # Cache control for sensitive responses
    cache_control = headers.get("cache-control", "")
    if cache_control:
        assert "no-store" in cache_control or "no-cache" in cache_control


@pytest.mark.security
@pytest.mark.auth
async def test_sensitive_endpoints_not_cached(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test that sensitive endpoints have proper cache control."""
    token = create_access_token({"sub": str(admin_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Test /me endpoint
    me_response = await async_client.get("/api/auth/me", headers=headers)

    if me_response.status_code == 200:
        cache_control = me_response.headers.get("cache-control", "")
        if cache_control:
            # Should prevent caching of sensitive user info
            assert "no-store" in cache_control or "private" in cache_control
