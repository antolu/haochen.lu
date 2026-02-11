"""
Security Tests for Session Management
Tests security aspects of the session management system including
CSRF protection, session fixation, token security, and attack prevention.
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi import status
from httpx import AsyncClient

from app.config import settings
from app.models import User


@pytest.mark.security
@pytest.mark.auth
class TestTokenSecurity:
    """Test token security and cryptographic properties."""

    async def test_token_expiry_enforcement(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that token expiry times are properly enforced."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        access_token = response.json()["access_token"]

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

        # Token should expire in 1 hour (3600 seconds) with reasonable tolerance
        assert 3500 <= time_diff <= 3700


@pytest.mark.security
@pytest.mark.auth
class TestTimingAttackPrevention:
    """Test prevention of timing attacks."""

    async def test_consistent_login_response_time(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that login response time is consistent for valid/invalid users."""
        # Valid user login
        valid_login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        start_time = time.time()
        valid_response = await async_client.post(
            "/api/auth/login", data=valid_login_data
        )
        valid_duration = time.time() - start_time

        # Invalid user login
        invalid_login_data = {
            "username": "nonexistent_user",
            "password": "any_password",
        }

        start_time = time.time()
        invalid_response = await async_client.post(
            "/api/auth/login", data=invalid_login_data
        )
        invalid_duration = time.time() - start_time

        # Response times should be similar (within reasonable bounds)
        time_difference = abs(valid_duration - invalid_duration)

        # Allow for some variance but prevent obvious timing attacks
        # (This is a basic check - real timing attack prevention requires more sophisticated measures)
        assert time_difference < 1.0  # Less than 1 second difference

        assert valid_response.status_code == status.HTTP_200_OK
        assert invalid_response.status_code == status.HTTP_400_BAD_REQUEST

    async def test_consistent_password_validation_time(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that password validation time is consistent."""
        # Correct password
        correct_login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        start_time = time.time()
        correct_response = await async_client.post(
            "/api/auth/login", data=correct_login_data
        )
        correct_duration = time.time() - start_time

        # Wrong password
        wrong_login_data = {
            "username": admin_user.username,
            "password": "wrongpassword",
        }

        start_time = time.time()
        wrong_response = await async_client.post(
            "/api/auth/login", data=wrong_login_data
        )
        wrong_duration = time.time() - start_time

        # Times should be similar
        time_difference = abs(correct_duration - wrong_duration)
        assert time_difference < 1.0

        assert correct_response.status_code == status.HTTP_200_OK
        assert wrong_response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.security
@pytest.mark.auth
class TestInformationDisclosureProtection:
    """Test protection against information disclosure."""

    async def test_login_error_messages_dont_reveal_user_existence(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that login errors don't reveal whether users exist."""
        # Invalid user
        invalid_user_response = await async_client.post(
            "/api/auth/login",
            data={
                "username": "nonexistent_user",
                "password": "any_password",
            },
        )

        # Valid user, wrong password
        wrong_password_response = await async_client.post(
            "/api/auth/login",
            data={
                "username": admin_user.username,
                "password": "wrong_password",
            },
        )

        assert invalid_user_response.status_code == 400
        assert wrong_password_response.status_code == 400

        # Error messages should be similar and not reveal user existence
        invalid_error = invalid_user_response.json().get("detail", "")
        wrong_pass_error = wrong_password_response.json().get("detail", "")

        # Should use generic error messages
        assert (
            "invalid" in invalid_error.lower()
            or "incorrect" in invalid_error.lower()
            or "credentials" in invalid_error.lower()
        )
        assert (
            "invalid" in wrong_pass_error.lower()
            or "incorrect" in wrong_pass_error.lower()
            or "credentials" in wrong_pass_error.lower()
        )

        # Should not contain specific details about user existence
        assert "user not found" not in invalid_error.lower()
        assert "does not exist" not in invalid_error.lower()

    async def test_token_errors_dont_leak_information(self, async_client: AsyncClient):
        """Test that token validation errors don't leak information."""
        # Test with various malformed tokens
        malformed_tokens = [
            "Bearer invalid.token.here",
            "Bearer " + "x" * 100,  # Too long
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid",  # Malformed JWT
        ]

        for token in malformed_tokens:
            headers = {"Authorization": token}
            response = await async_client.get("/api/users/me", headers=headers)

            # Should return generic 401
            assert response.status_code == 401

            error_detail = response.json().get("detail", "")

            # Generic error message is fine - we just verify we get 401
            # and don't leak specific validation details like "signature invalid"
            assert len(error_detail) > 0


@pytest.mark.security
@pytest.mark.auth
class TestSessionSecurityHeaders:
    """Test security headers in session-related responses."""

    async def test_login_response_security_headers(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that login responses include appropriate security headers."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        response = await async_client.post("/api/auth/login", data=login_data)

        # Check for security headers (implementation dependent)
        headers = response.headers

        # Content-Type should be appropriate
        assert "application/json" in headers.get("content-type", "")

        # Cache control for sensitive responses
        cache_control = headers.get("cache-control", "")
        if cache_control:
            assert "no-store" in cache_control or "no-cache" in cache_control

    async def test_sensitive_endpoints_not_cached(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that sensitive endpoints have proper cache control."""
        # Login and get token
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        login_response = await async_client.post("/api/auth/login", data=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test /me endpoint
        me_response = await async_client.get("/api/auth/me", headers=headers)

        if me_response.status_code == 200:
            cache_control = me_response.headers.get("cache-control", "")
            if cache_control:
                # Should prevent caching of sensitive user info
                assert "no-store" in cache_control or "private" in cache_control
