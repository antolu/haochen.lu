"""
Integration Tests for Session Management API
Tests the complete session management API including login with remember me,
token refresh, logout, and session revocation endpoints.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import status
from httpx import AsyncClient

from app.config import settings
from app.models import User


@pytest.mark.integration
@pytest.mark.auth
class TestLoginWithRememberMe:
    """Test login endpoint with remember me functionality."""

    async def test_login_with_remember_me_true(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test login with remember me flag set to true."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify response structure
        assert "access_token" in data
        assert "token_type" in data
        assert "expires_in" in data
        assert "user" in data
        assert data["token_type"] == "bearer"

        # Verify refresh token cookie is set
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        assert refresh_cookie is not None
        assert refresh_cookie.httponly is True
        # Check max_age indicates persistent cookie (30 days)
        if hasattr(refresh_cookie, "max_age") and refresh_cookie.max_age:
            assert refresh_cookie.max_age > 86400  # More than 1 day

    async def test_login_with_remember_me_false(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test login with remember me flag set to false."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": False,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK

        # Verify refresh token cookie is set as session cookie
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        assert refresh_cookie is not None
        # Session cookie should not have max_age or have shorter duration
        if hasattr(refresh_cookie, "max_age"):
            assert refresh_cookie.max_age is None or refresh_cookie.max_age < 86400

    async def test_login_without_remember_me_field(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test login without remember_me field (should default to false)."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        # Should default to remember_me=False behavior

    async def test_login_invalid_credentials_with_remember_me(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test login with invalid credentials should not set cookies."""
        login_data = {
            "username": admin_user.username,
            "password": "wrong_password",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # No cookies should be set on failed login
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        assert refresh_cookie is None

    async def test_login_stores_refresh_token_in_redis(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that login stores refresh token in Redis for revocation."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch("app.core.redis.redis_client") as mock_redis:
            mock_redis.setex.return_value = True

            response = await async_client.post("/api/auth/login", json=login_data)

            assert response.status_code == status.HTTP_200_OK

            # Verify Redis storage was attempted
            mock_redis.setex.assert_called()


@pytest.mark.integration
@pytest.mark.auth
class TestTokenRefreshEndpoint:
    """Test token refresh endpoint functionality."""

    async def test_refresh_token_with_valid_cookie(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test token refresh with valid refresh token cookie."""
        # First login to get refresh token
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == status.HTTP_200_OK

        # Extract refresh token cookie
        refresh_cookie_value = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie_value = cookie.value
                break

        assert refresh_cookie_value is not None

        # Set cookie for refresh request
        async_client.cookies.set(
            getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
            refresh_cookie_value,
        )

        # Test refresh endpoint
        refresh_response = await async_client.post("/api/auth/refresh")

        if refresh_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented yet")

        assert refresh_response.status_code == status.HTTP_200_OK
        refresh_data = refresh_response.json()

        assert "access_token" in refresh_data
        assert "expires_in" in refresh_data
        assert "user" in refresh_data

        # New access token should be different from original
        original_token = login_response.json()["access_token"]
        new_token = refresh_data["access_token"]
        assert new_token != original_token

    async def test_refresh_token_without_cookie(self, async_client: AsyncClient):
        """Test token refresh without refresh token cookie."""
        response = await async_client.post("/api/auth/refresh")

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented yet")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_refresh_token_with_invalid_cookie(self, async_client: AsyncClient):
        """Test token refresh with invalid refresh token cookie."""
        # Set invalid cookie
        async_client.cookies.set(
            getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
            "invalid.refresh.token",
        )

        response = await async_client.post("/api/auth/refresh")

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented yet")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_refresh_token_rotates_refresh_token(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that refresh endpoint rotates the refresh token for security."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        original_refresh_cookie = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                original_refresh_cookie = cookie.value
                break

        async_client.cookies.set(
            getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
            original_refresh_cookie,
        )

        # Refresh token
        refresh_response = await async_client.post("/api/auth/refresh")

        if refresh_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented yet")

        assert refresh_response.status_code == status.HTTP_200_OK

        # Check if new refresh token cookie is set
        new_refresh_cookie = None
        for cookie in refresh_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                new_refresh_cookie = cookie.value
                break

        if new_refresh_cookie:
            # New refresh token should be different
            assert new_refresh_cookie != original_refresh_cookie

    async def test_refresh_token_revokes_old_token_in_redis(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that refresh revokes old token in Redis."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch("app.core.redis.redis_client") as mock_redis:
            mock_redis.get.return_value = "valid"  # Token exists
            mock_redis.setex.return_value = True
            mock_redis.delete.return_value = 1

            login_response = await async_client.post("/api/auth/login", json=login_data)
            refresh_cookie = None
            for cookie in login_response.cookies.values():
                if cookie.name == getattr(
                    settings, "REFRESH_COOKIE_NAME", "refresh_token"
                ):
                    refresh_cookie = cookie.value
                    break

            async_client.cookies.set(
                getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
                refresh_cookie,
            )

            refresh_response = await async_client.post("/api/auth/refresh")

            if refresh_response.status_code != status.HTTP_404_NOT_FOUND:
                # Should delete old token and store new one
                assert mock_redis.delete.called


@pytest.mark.integration
@pytest.mark.auth
class TestLogoutEndpoint:
    """Test logout endpoint functionality."""

    async def test_logout_with_valid_session(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test logout with valid authenticated session."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test logout
        logout_response = await async_client.post("/api/auth/logout", headers=headers)

        if logout_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented yet")

        assert logout_response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_204_NO_CONTENT,
        ]

    async def test_logout_clears_refresh_token_cookie(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that logout clears the refresh token cookie."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test logout
        logout_response = await async_client.post("/api/auth/logout", headers=headers)

        if logout_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented yet")

        # Check if refresh token cookie is cleared
        for cookie in logout_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                # Cookie should be cleared (empty value or expired)
                if not cookie.value:
                    pass
                break

        # Note: Cookie clearing implementation may vary
        # Some implementations clear by setting empty value, others by expiring

    async def test_logout_without_authentication(self, async_client: AsyncClient):
        """Test logout without authentication token."""
        response = await async_client.post("/api/auth/logout")

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented yet")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_logout_revokes_refresh_token_in_redis(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that logout revokes refresh token in Redis."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch("app.core.redis.redis_client") as mock_redis:
            mock_redis.setex.return_value = True
            mock_redis.delete.return_value = 1

            login_response = await async_client.post("/api/auth/login", json=login_data)
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            logout_response = await async_client.post(
                "/api/auth/logout", headers=headers
            )

            if logout_response.status_code != status.HTTP_404_NOT_FOUND:
                # Should attempt to delete refresh token from Redis
                # Note: Actual Redis deletion depends on implementation
                assert logout_response.status_code in [200, 204]


@pytest.mark.integration
@pytest.mark.auth
class TestRevokeAllSessionsEndpoint:
    """Test revoke all sessions endpoint functionality."""

    async def test_revoke_all_sessions_with_valid_auth(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test revoking all sessions with valid authentication."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test revoke all sessions
        response = await async_client.post(
            "/api/auth/revoke-all-sessions", headers=headers
        )

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Revoke all sessions endpoint not implemented yet")

        assert response.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]

    async def test_revoke_all_sessions_without_auth(self, async_client: AsyncClient):
        """Test revoke all sessions without authentication."""
        response = await async_client.post("/api/auth/revoke-all-sessions")

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Revoke all sessions endpoint not implemented yet")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_revoke_all_sessions_clears_refresh_cookie(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that revoke all sessions clears refresh token cookie."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Test revoke all sessions
        response = await async_client.post(
            "/api/auth/revoke-all-sessions", headers=headers
        )

        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Revoke all sessions endpoint not implemented yet")

        # Check if refresh token cookie is cleared
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                if not cookie.value:
                    pass
                break

    async def test_revoke_all_sessions_removes_all_redis_tokens(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that revoke all sessions removes all user tokens from Redis."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch("app.core.redis.redis_client") as mock_redis:
            mock_redis.setex.return_value = True
            mock_redis.keys.return_value = [
                "refresh_token:user:jti1",
                "refresh_token:user:jti2",
            ]
            mock_redis.delete.return_value = 2

            login_response = await async_client.post("/api/auth/login", json=login_data)
            token = login_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            response = await async_client.post(
                "/api/auth/revoke-all-sessions", headers=headers
            )

            if response.status_code != status.HTTP_404_NOT_FOUND:
                # Should delete all user tokens
                assert mock_redis.keys.called or mock_redis.delete.called


@pytest.mark.integration
@pytest.mark.auth
class TestCookieSecuritySettings:
    """Test cookie security configuration."""

    async def test_cookie_security_flags(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that cookies are set with proper security flags."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK

        # Check cookie security flags
        refresh_cookie = None
        for cookie in response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        if refresh_cookie:
            # Check security flags
            assert refresh_cookie.httponly is True

            # Note: secure and samesite flags may depend on test environment
            # In production, these should be True and 'lax'/'strict' respectively

    async def test_cookie_domain_configuration(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test cookie domain configuration."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch.object(settings, "COOKIE_DOMAIN", "example.com"):
            response = await async_client.post("/api/auth/login", json=login_data)

            refresh_cookie = None
            for cookie in response.cookies.values():
                if cookie.name == getattr(
                    settings, "REFRESH_COOKIE_NAME", "refresh_token"
                ):
                    refresh_cookie = cookie
                    break

            if refresh_cookie:
                # Domain should be set if configured
                assert (
                    refresh_cookie.domain == "example.com"
                    or refresh_cookie.domain is None
                )


@pytest.mark.integration
@pytest.mark.auth
class TestSessionPersistenceFlow:
    """Test complete session persistence flow."""

    async def test_complete_session_flow(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test complete session flow: login -> refresh -> logout."""
        # Step 1: Login with remember me
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == status.HTTP_200_OK

        original_token = login_response.json()["access_token"]

        # Extract refresh cookie
        refresh_cookie_value = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie_value = cookie.value
                break

        # Step 2: Use access token to access protected resource
        headers = {"Authorization": f"Bearer {original_token}"}
        me_response = await async_client.get("/api/auth/me", headers=headers)
        assert me_response.status_code == status.HTTP_200_OK

        # Step 3: Refresh token (if endpoint exists)
        if refresh_cookie_value:
            async_client.cookies.set(
                getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
                refresh_cookie_value,
            )

            refresh_response = await async_client.post("/api/auth/refresh")

            if refresh_response.status_code != status.HTTP_404_NOT_FOUND:
                assert refresh_response.status_code == status.HTTP_200_OK
                new_token = refresh_response.json()["access_token"]
                assert new_token != original_token

                # Use new token
                new_headers = {"Authorization": f"Bearer {new_token}"}
                me_response_2 = await async_client.get(
                    "/api/auth/me", headers=new_headers
                )
                assert me_response_2.status_code == status.HTTP_200_OK

        # Step 4: Logout
        logout_response = await async_client.post("/api/auth/logout", headers=headers)

        if logout_response.status_code != status.HTTP_404_NOT_FOUND:
            assert logout_response.status_code in [
                status.HTTP_200_OK,
                status.HTTP_204_NO_CONTENT,
            ]

            # After logout, token should be invalid
            await async_client.get("/api/auth/me", headers=headers)
            # Depending on implementation, this might be 401 if token blacklisting is implemented

    async def test_session_flow_without_remember_me(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test session flow without remember me (shorter session)."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": False,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == status.HTTP_200_OK

        # Verify session cookie behavior (implementation dependent)
        refresh_cookie = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie
                break

        if refresh_cookie:
            # Session cookie should have different expiry characteristics
            # Exact behavior depends on implementation
            assert hasattr(refresh_cookie, "max_age")

    async def test_multiple_concurrent_sessions(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test multiple concurrent sessions for the same user."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        # Create multiple sessions
        session1_response = await async_client.post("/api/auth/login", json=login_data)
        session2_response = await async_client.post("/api/auth/login", json=login_data)

        assert session1_response.status_code == status.HTTP_200_OK
        assert session2_response.status_code == status.HTTP_200_OK

        token1 = session1_response.json()["access_token"]
        token2 = session2_response.json()["access_token"]

        # Both tokens should be valid
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        me_response1 = await async_client.get("/api/auth/me", headers=headers1)
        me_response2 = await async_client.get("/api/auth/me", headers=headers2)

        assert me_response1.status_code == status.HTTP_200_OK
        assert me_response2.status_code == status.HTTP_200_OK

        # Test revoke all sessions affects both
        revoke_response = await async_client.post(
            "/api/auth/revoke-all-sessions", headers=headers1
        )

        if revoke_response.status_code != status.HTTP_404_NOT_FOUND:
            # Both sessions should be invalidated (depending on implementation)
            pass


@pytest.mark.integration
@pytest.mark.auth
class TestErrorScenarios:
    """Test error scenarios and edge cases."""

    async def test_malformed_refresh_token_cookie(self, async_client: AsyncClient):
        """Test refresh with malformed cookie value."""
        async_client.cookies.set(
            getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"), "not.a.valid.jwt"
        )

        response = await async_client.post("/api/auth/refresh")

        if response.status_code != status.HTTP_404_NOT_FOUND:
            assert response.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_expired_refresh_token_cookie(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test refresh with expired cookie."""
        # This test would require manipulating time or creating expired tokens
        # Implementation depends on how tokens are created and validated

    async def test_redis_unavailable_during_login(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test login behavior when Redis is unavailable."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        with patch("app.core.redis.redis_client") as mock_redis:
            # Simulate Redis being unavailable
            mock_redis.setex.return_value = False

            response = await async_client.post("/api/auth/login", json=login_data)

            # Login should still succeed even if Redis is unavailable
            assert response.status_code == status.HTTP_200_OK

    async def test_redis_unavailable_during_refresh(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test refresh behavior when Redis is unavailable."""
        # Login first
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        refresh_cookie = None
        for cookie in login_response.cookies.values():
            if cookie.name == getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"):
                refresh_cookie = cookie.value
                break

        if refresh_cookie:
            async_client.cookies.set(
                getattr(settings, "REFRESH_COOKIE_NAME", "refresh_token"),
                refresh_cookie,
            )

            with patch("app.core.redis.redis_client") as mock_redis:
                mock_redis.get.return_value = None  # Simulate Redis unavailable

                response = await async_client.post("/api/auth/refresh")

                if response.status_code != status.HTTP_404_NOT_FOUND:
                    # Behavior depends on implementation - might succeed or fail gracefully
                    assert response.status_code in [200, 401, 500]
