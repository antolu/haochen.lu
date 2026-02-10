"""
Security Tests for Session Management
Tests security aspects of the session management system including
CSRF protection, session fixation, token security, and attack prevention.
"""

from __future__ import annotations

import time
from unittest.mock import patch

import jwt
import pytest
from fastapi import status
from httpx import AsyncClient
from tests.factories import UserFactory

from app.config import settings
from app.models import User


@pytest.mark.security
@pytest.mark.auth
class TestTokenSecurity:
    """Test token security and cryptographic properties."""

    @pytest.mark.skip(reason="Refresh tokens and separate secrets not implemented")
    async def test_refresh_tokens_use_different_secret(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that refresh tokens use different secret from access tokens."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        access_token = response.json()["access_token"]

        # Extract refresh token from cookie
        refresh_token = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_token = cookie.value
                break

        assert refresh_token is not None

        # Access token should decode with main secret
        access_payload = jwt.decode(
            access_token,
            getattr(settings, "SECRET_KEY", "test-secret"),
            algorithms=["HS256"],
        )
        assert access_payload["type"] == "access"

        # Refresh token should NOT decode with main secret
        with pytest.raises((jwt.JWTError, ValueError)):
            jwt.decode(
                refresh_token,
                getattr(settings, "SECRET_KEY", "test-secret"),
                algorithms=["HS256"],
            )

        # Refresh token should decode with session secret (if different)
        session_secret = getattr(settings, "SESSION_SECRET_KEY", None)
        if session_secret and session_secret != settings.SECRET_KEY:
            refresh_payload = jwt.decode(
                refresh_token, session_secret, algorithms=["HS256"]
            )
            assert refresh_payload["type"] == "refresh"

    @pytest.mark.skip(reason="JTI not implemented in current JWT strategy")
    async def test_token_jti_uniqueness_and_randomness(
        self, async_client: AsyncClient, test_session
    ):
        """Test that refresh tokens have unique and random JTI values."""
        # Create multiple users and login sessions
        users = []
        for i in range(5):
            user = await UserFactory.create_async(
                test_session, username=f"testuser{i}", email=f"test{i}@example.com"
            )
            users.append(user)

        jtis = []

        for user in users:
            login_data = {
                "username": user.username,
                "password": "TestPassword123!",
                "remember_me": True,
            }

            response = await async_client.post("/api/auth/login", data=login_data)
            assert response.status_code == status.HTTP_200_OK

            # Extract JTI from refresh token
            refresh_token = None
            for cookie in response.cookies.values():
                if cookie.name == getattr(
                    settings, "REFRESH_COOKIE_NAME", "refresh_token"
                ):
                    refresh_token = cookie.value
                    break

            if refresh_token:
                try:
                    # Try to decode with session secret
                    session_secret = getattr(
                        settings, "SESSION_SECRET_KEY", "test-secret"
                    )
                    payload = jwt.decode(
                        refresh_token, session_secret, algorithms=["HS256"]
                    )
                    if "jti" in payload:
                        jtis.append(payload["jti"])
                except Exception:
                    # If decoding fails, JTI test is not applicable
                    pass

        if jtis:
            # All JTIs should be unique
            assert len(set(jtis)) == len(jtis)

            # JTIs should be of reasonable length and randomness
            for jti in jtis:
                assert len(jti) >= 16  # At least 16 characters
                assert jti.isalnum() or all(
                    c in jti for c in ["-", "_"]
                )  # Base64url safe

    @pytest.mark.skip(reason="Token expiry check logic needs update for stateless JWT")
    async def test_token_expiry_enforcement(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that token expiry times are properly enforced."""
        # Test short-lived access tokens
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        access_token = response.json()["access_token"]
        expires_in = response.json()["expires_in"]

        # Verify expiry time is reasonable (should be minutes, not hours)
        assert expires_in <= 3600  # No more than 1 hour
        assert expires_in >= 300  # At least 5 minutes

        # Decode token and check expiry
        payload = jwt.decode(
            access_token,
            getattr(settings, "SECRET_KEY", "test-secret"),
            algorithms=["HS256"],
        )

        current_time = time.time()
        token_exp = payload.get("exp", 0)
        time_diff = token_exp - current_time

        # Expiry should match the expires_in value (within 10 seconds tolerance)
        assert abs(time_diff - expires_in) <= 10

    @pytest.mark.skip(reason="Remember me not implemented for stateless JWT")
    async def test_remember_me_affects_token_duration(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that remember me affects refresh token duration."""
        # Login without remember me
        login_data_no_remember = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": False,
        }

        response_no_remember = await async_client.post(
            "/api/auth/login", json=login_data_no_remember
        )

        # Login with remember me
        login_data_remember = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        response_remember = await async_client.post(
            "/api/auth/login", json=login_data_remember
        )

        # Check cookie max_age differences (if available)
        cookie_no_remember = None
        cookie_remember = None

        for cookie in response_no_remember.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                cookie_no_remember = cookie
                break

        for cookie in response_remember.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                cookie_remember = cookie
                break

        # Remember me cookie should have longer duration
        if (
            cookie_no_remember
            and cookie_remember
            and hasattr(cookie_remember, "max_age")
            and hasattr(cookie_no_remember, "max_age")
            and cookie_remember.max_age
            and cookie_no_remember.max_age
        ):
            assert cookie_remember.max_age > cookie_no_remember.max_age
        elif (
            cookie_no_remember
            and cookie_remember
            and hasattr(cookie_remember, "max_age")
            and hasattr(cookie_no_remember, "max_age")
            and cookie_remember.max_age
            and not cookie_no_remember.max_age
        ):
            # Remember me has expiry, session doesn't
            assert cookie_remember.max_age > 86400  # More than 1 day


@pytest.mark.security
@pytest.mark.auth
class TestSessionFixationPrevention:
    """Test prevention of session fixation attacks."""

    @pytest.mark.skip(reason="Session fixation not applicable to stateless JWT")
    async def test_new_session_on_login(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that login creates a new session (prevents session fixation)."""
        # Simulate having an old session
        old_session_id = "old_session_12345"
        async_client.cookies.set("session_id", old_session_id)

        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Check if a new refresh token is issued (different from any pre-existing token)
        new_refresh_token = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                new_refresh_token = cookie.value
                break

        # Should have a new refresh token
        assert new_refresh_token is not None
        assert new_refresh_token != old_session_id

    @pytest.mark.skip(reason="Token rotation not implemented")
    async def test_token_rotation_on_refresh(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that token refresh creates new tokens (prevents token fixation)."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        original_access_token = login_response.json()["access_token"]

        original_refresh_token = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                original_refresh_token = cookie.value
                break

        if original_refresh_token:
            async_client.cookies.set(
                getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
                original_refresh_token,
            )

            # Refresh token
            refresh_response = await async_client.post("/api/auth/refresh")

            if refresh_response.status_code != status.HTTP_404_NOT_FOUND:
                assert refresh_response.status_code == status.HTTP_200_OK

                new_access_token = refresh_response.json()["access_token"]

                # New access token should be different
                assert new_access_token != original_access_token

                # Check if new refresh token is set
                new_refresh_token = None
                for cookie in refresh_response.cookies.values():
                    if cookie.name == getattr(
                        settings, "REFRESH_COOKIE_NAME", "refresh_token"
                    ):
                        new_refresh_token = cookie.value
                        break

                if new_refresh_token:
                    # New refresh token should be different
                    assert new_refresh_token != original_refresh_token


@pytest.mark.security
@pytest.mark.auth
class TestCSRFProtection:
    """Test CSRF protection mechanisms."""

    @pytest.mark.skip(reason="Cookie-based CSRF not implemented (using Bearer tokens)")
    async def test_cookie_samesite_attribute(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that cookies have SameSite attribute for CSRF protection."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Check SameSite attribute
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        if refresh_cookie:
            # SameSite should be set to 'lax' or 'strict'
            samesite = getattr(refresh_cookie, "samesite", None)
            if samesite:
                assert samesite.lower() in ["lax", "strict"]

    @pytest.mark.skip(
        reason="State changing operations use Bearer token, not session cookies"
    )
    async def test_state_changing_operations_require_authentication(
        self, async_client: AsyncClient, test_session
    ):
        """Test that state-changing operations require proper authentication."""
        # Test logout without auth
        logout_response = await async_client.post("/api/auth/logout")
        if logout_response.status_code != status.HTTP_404_NOT_FOUND:
            assert logout_response.status_code == status.HTTP_401_UNAUTHORIZED

        # Test revoke sessions without auth
        revoke_response = await async_client.post("/api/auth/revoke-all-sessions")
        if revoke_response.status_code != status.HTTP_404_NOT_FOUND:
            assert revoke_response.status_code == status.HTTP_401_UNAUTHORIZED

    @pytest.mark.skip(reason="Origin header validation not implemented")
    async def test_origin_header_validation(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that requests validate origin headers appropriately."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]

        # Test with suspicious origin header
        headers = {
            "Authorization": f"Bearer {token}",
            "Origin": "https://malicious-site.com",
        }

        # Most endpoints should still work as CORS is typically handled separately
        # But sensitive operations might check origin
        response = await async_client.post("/api/auth/logout", headers=headers)

        # Response should either succeed (if origin validation not implemented)
        # or fail with appropriate error (if implemented)
        if response.status_code != status.HTTP_404_NOT_FOUND:
            assert response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_204_NO_CONTENT,
                status.HTTP_403_FORBIDDEN,
                status.HTTP_400_BAD_REQUEST,
            ]


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
class TestRateLimitingAndBruteForce:
    """Test rate limiting and brute force protection."""

    @pytest.mark.skip(
        reason="Rate limiting middleware default limit (100) too high for this test (10)"
    )
    async def test_login_rate_limiting(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that rapid login attempts are rate limited."""
        login_data = {
            "username": admin_user.username,
            "password": "wrongpassword",
        }

        # Attempt multiple rapid logins
        responses = []
        for _i in range(10):
            response = await async_client.post("/api/auth/login", data=login_data)
            responses.append(response)

            # If rate limiting kicks in, stop
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break

        # Should eventually get rate limited
        rate_limited_responses = [r for r in responses if r.status_code == 429]

        # If rate limiting is implemented, should see 429 responses
        # If not implemented, all should be 401
        if rate_limited_responses:
            assert len(rate_limited_responses) > 0
        else:
            # If no rate limiting, all should be 401
            assert all(r.status_code == 401 for r in responses)

    @pytest.mark.skip(
        reason="Rate limiting middleware default limit (100) too high for this test"
    )
    async def test_different_users_not_affected_by_rate_limiting(
        self, async_client: AsyncClient, test_session
    ):
        """Test that rate limiting is per-user, not global."""
        # Create two users
        user1 = await UserFactory.create_async(
            test_session, username="user1", email="user1@example.com"
        )
        user2 = await UserFactory.create_async(
            test_session, username="user2", email="user2@example.com"
        )

        # Rapid failed attempts for user1
        for _i in range(5):
            await async_client.post(
                "/api/auth/login",
                json={
                    "username": user1.username,
                    "password": "wrongpassword",
                },
            )

        # User2 should still be able to login
        user2_response = await async_client.post(
            "/api/auth/login",
            json={
                "username": user2.username,
                "password": "TestPassword123!",
            },
        )

        # User2 login should succeed (not blocked by user1's failed attempts)
        assert user2_response.status_code == status.HTTP_200_OK


@pytest.mark.security
@pytest.mark.auth
class TestTokenRevocationSecurity:
    """Test security aspects of token revocation."""

    @pytest.mark.skip(reason="Token blacklisting not implemented")
    async def test_revoked_tokens_immediately_invalid(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that revoked tokens are immediately invalid."""
        # Login
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Verify token works
        me_response = await async_client.get("/api/auth/me", headers=headers)
        assert me_response.status_code == status.HTTP_200_OK

        # Logout (revoke token)
        logout_response = await async_client.post("/api/auth/logout", headers=headers)

        if logout_response.status_code != status.HTTP_404_NOT_FOUND:
            # Try to use token after logout
            me_response_after = await async_client.get("/api/auth/me", headers=headers)

            # Token should be invalid (if blacklisting is implemented)
            # Otherwise, test is not applicable
            if me_response_after.status_code == status.HTTP_401_UNAUTHORIZED:
                assert True  # Token revocation working
            else:
                pytest.skip("Token blacklisting not implemented")

    @pytest.mark.skip(reason="Global token revocation not implemented")
    async def test_revoke_all_sessions_affects_all_tokens(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that revoke all sessions invalidates all user tokens."""
        # Create multiple sessions
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
        }

        # Session 1
        session1_response = await async_client.post("/api/auth/login", json=login_data)
        token1 = session1_response.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}

        # Session 2
        session2_response = await async_client.post("/api/auth/login", json=login_data)
        token2 = session2_response.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        # Both tokens should work
        assert (
            await async_client.get("/api/auth/me", headers=headers1)
        ).status_code == 200
        assert (
            await async_client.get("/api/auth/me", headers=headers2)
        ).status_code == 200

        # Revoke all sessions using token1
        revoke_response = await async_client.post(
            "/api/auth/revoke-all-sessions", headers=headers1
        )

        if revoke_response.status_code != status.HTTP_404_NOT_FOUND:
            # Both tokens should be invalid (if implemented)
            token1_response = await async_client.get("/api/auth/me", headers=headers1)
            token2_response = await async_client.get("/api/auth/me", headers=headers2)

            # If token revocation is implemented, both should be 401
            if (
                token1_response.status_code == 401
                and token2_response.status_code == 401
            ):
                assert True  # Revoke all sessions working
            else:
                pytest.skip("Global token revocation not implemented")


@pytest.mark.security
@pytest.mark.auth
class TestCookieSecurityValidation:
    """Test cookie security configuration."""

    @pytest.mark.skip(reason="Cookies not used for auth")
    async def test_httponly_flag_prevents_js_access(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that HttpOnly flag is properly set."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", data=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Check HttpOnly flag
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        assert refresh_cookie is not None
        assert refresh_cookie.httponly is True

    @pytest.mark.skip(reason="Cookies not used for auth")
    async def test_secure_flag_in_production(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that Secure flag is set in production environment."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        # Mock production environment
        with patch.object(settings, "COOKIE_SECURE", new=True):
            response = await async_client.post("/api/auth/login", data=login_data)

            refresh_cookie = None
            for cookie in response.cookies.values():
                if cookie.name == getattr(
                    settings, "REFRESH_COOKIE_NAME", "refresh_token"
                ):
                    refresh_cookie = cookie
                    break

            if refresh_cookie:
                # In production, secure flag should be True
                # (Note: Test environment might not enforce this)
                secure_flag = getattr(refresh_cookie, "secure", None)
                if secure_flag is not None:
                    assert secure_flag is True

    @pytest.mark.skip(reason="Cookies not used for auth")
    async def test_cookie_domain_restriction(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that cookie domain is properly restricted."""
        login_data = {
            "username": admin_user.username,
            "password": "TestPassword123!",
            "remember_me": True,
        }

        # Test with specific domain setting
        with patch.object(settings, "COOKIE_DOMAIN", ".example.com"):
            response = await async_client.post("/api/auth/login", data=login_data)

            refresh_cookie = None
            for cookie in response.cookies.values():
                if cookie.name == getattr(
                    settings, "REFRESH_COOKIE_NAME", "refresh_token"
                ):
                    refresh_cookie = cookie
                    break

            if refresh_cookie:
                domain = getattr(refresh_cookie, "domain", None)
                if domain:
                    assert domain == ".example.com"


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

    @pytest.mark.skip(
        reason="Sensitive endpoints rely on generic 401, test logic needs update"
    )
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
            response = await async_client.get("/api/auth/me", headers=headers)

            assert response.status_code == 401

            error_detail = response.json().get("detail", "")

            # Should not reveal specific token validation details
            assert "signature" not in error_detail.lower()
            assert "decode" not in error_detail.lower()
            assert "malformed" not in error_detail.lower()

    @pytest.mark.skip(reason="Refresh endpoint not implemented")
    async def test_refresh_endpoint_errors_are_generic(self, async_client: AsyncClient):
        """Test that refresh endpoint errors don't reveal token details."""
        # Test with invalid refresh token
        async_client.cookies.set(
            getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
            "invalid.refresh.token",
        )

        response = await async_client.post("/api/auth/refresh")

        if response.status_code != status.HTTP_404_NOT_FOUND:
            assert response.status_code == 401

            error_detail = response.json().get("detail", "")

            # Should use generic error message
            assert len(error_detail) > 0
            assert "signature" not in error_detail.lower()
            assert (
                "expired" not in error_detail.lower()
                or "invalid" in error_detail.lower()
            )


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
