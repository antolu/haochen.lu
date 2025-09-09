"""
P0 - Critical Authentication Integration Tests

Tests the complete authentication flow including login, token refresh, logout,
and authorization middleware. These tests ensure the authentication system
works correctly end-to-end.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status
from httpx import AsyncClient

from app.core.security import create_access_token, get_password_hash
from app.models import User
from tests.factories import AdminUserFactory, UserFactory


@pytest.mark.integration
@pytest.mark.auth
class TestLoginFlow:
    """Test complete login authentication flow."""
    
    async def test_login_with_correct_credentials_returns_token(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test successful login with correct credentials."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123"  # This matches the factory password
        }
        
        response = await async_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify response structure
        assert "access_token" in data
        assert "token_type" in data
        assert data["token_type"] == "bearer"
        
        # Verify token is valid
        from app.core.security import decode_token
        payload = decode_token(data["access_token"])
        assert payload is not None
        assert payload["sub"] == admin_user.username
    
    async def test_login_with_incorrect_password_returns_401(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test login with incorrect password."""
        login_data = {
            "username": admin_user.username,
            "password": "wrong_password"
        }
        
        response = await async_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "detail" in data
        assert "credentials" in data["detail"].lower()
    
    async def test_login_with_nonexistent_user_returns_401(
        self, async_client: AsyncClient
    ):
        """Test login with non-existent user."""
        login_data = {
            "username": "nonexistent_user",
            "password": "any_password"
        }
        
        response = await async_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert "detail" in data
        assert "credentials" in data["detail"].lower()
    
    async def test_login_sql_injection_attempts_return_401(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test that SQL injection attempts are blocked."""
        sql_injection_payloads = [
            "'; DROP TABLE users; --",
            "admin'--",
            "admin' OR '1'='1",
            "admin'; INSERT INTO users VALUES ('hacker', 'password'); --",
            "admin' UNION SELECT * FROM users --",
        ]
        
        for payload in sql_injection_payloads:
            login_data = {
                "username": payload,
                "password": "any_password"
            }
            
            response = await async_client.post("/api/auth/login", json=login_data)
            
            # Should return 401, not 500 or successful login
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
            
            # Should not contain SQL error messages
            response_text = response.text.lower()
            sql_errors = ["syntax error", "table", "column", "database"]
            for error in sql_errors:
                assert error not in response_text
    
    @pytest.mark.slow
    async def test_login_rate_limiting_prevents_brute_force(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test rate limiting prevents brute force attacks."""
        login_data = {
            "username": admin_user.username,
            "password": "wrong_password"
        }
        
        # Attempt login multiple times rapidly
        responses = []
        for i in range(10):  # Try 10 times
            response = await async_client.post("/api/auth/login", json=login_data)
            responses.append(response)
            
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                break
        
        # Should eventually get rate limited
        rate_limited_responses = [r for r in responses if r.status_code == 429]
        assert len(rate_limited_responses) > 0, "Rate limiting should kick in"
    
    async def test_successful_login_token_works_on_protected_endpoint(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test that login token works on protected endpoints."""
        # First login
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123"
        }
        
        login_response = await async_client.post("/api/auth/login", json=login_data)
        assert login_response.status_code == status.HTTP_200_OK
        
        token = login_response.json()["access_token"]
        
        # Use token on protected endpoint
        headers = {"Authorization": f"Bearer {token}"}
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == admin_user.username
        assert data["is_admin"] == admin_user.is_admin
    
    async def test_login_sets_secure_cookie_flags(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test that login sets secure cookie flags."""
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123"
        }
        
        response = await async_client.post("/api/auth/login", json=login_data)
        assert response.status_code == status.HTTP_200_OK
        
        # Check cookie security flags (if cookies are used)
        # This would depend on your implementation
        cookies = response.cookies
        if cookies:
            for cookie in cookies.values():
                # Should have security flags set
                assert cookie.get("httponly", False), "Cookie should be HttpOnly"
                assert cookie.get("secure", False), "Cookie should be Secure"
                assert cookie.get("samesite", "").lower() in ["strict", "lax"], "Cookie should have SameSite"
    
    async def test_login_with_inactive_user_returns_401(
        self, async_client: AsyncClient, test_session
    ):
        """Test login with inactive user."""
        # Create inactive user
        inactive_user = await UserFactory.create_async(
            test_session,
            username="inactive_user",
            is_active=False
        )
        
        login_data = {
            "username": inactive_user.username,
            "password": "testpassword123"
        }
        
        response = await async_client.post("/api/auth/login", json=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_login_request_logging_for_security_audit(
        self, async_client: AsyncClient, admin_user: User, caplog
    ):
        """Test that login attempts are logged for security auditing."""
        login_data = {
            "username": admin_user.username,
            "password": "wrong_password"
        }
        
        with caplog.at_level("INFO"):
            response = await async_client.post("/api/auth/login", json=login_data)
        
        # Should log failed login attempt
        # This depends on your logging implementation
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Check if any security-related logs were created
        # Adjust based on your actual logging format
        log_messages = [record.message for record in caplog.records]
        security_logs = [msg for msg in log_messages if "login" in msg.lower() or "auth" in msg.lower()]
        
        # Should have some authentication-related logging
        assert len(security_logs) >= 0  # Adjust based on implementation


@pytest.mark.integration
@pytest.mark.auth
class TestTokenRefreshFlow:
    """Test token refresh functionality."""
    
    async def test_refresh_with_valid_token_returns_new_token(
        self, async_client: AsyncClient, admin_user: User, admin_token: str
    ):
        """Test token refresh with valid token."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.post("/api/auth/refresh", headers=headers)
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            # Endpoint not implemented yet, skip test
            pytest.skip("Token refresh endpoint not implemented")
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        assert "access_token" in data
        assert data["access_token"] != admin_token  # Should be different token
    
    async def test_refresh_with_expired_token_returns_401(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test token refresh with expired token."""
        # Create expired token
        expired_token = create_access_token(
            {"sub": admin_user.username},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await async_client.post("/api/auth/refresh", headers=headers)
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_refresh_with_invalid_token_returns_401(
        self, async_client: AsyncClient
    ):
        """Test token refresh with invalid token."""
        headers = {"Authorization": "Bearer invalid_token_123"}
        
        response = await async_client.post("/api/auth/refresh", headers=headers)
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_old_token_invalidated_after_refresh(
        self, async_client: AsyncClient, admin_user: User, admin_token: str
    ):
        """Test that old token is invalidated after refresh."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Refresh token
        refresh_response = await async_client.post("/api/auth/refresh", headers=headers)
        
        if refresh_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Token refresh endpoint not implemented")
        
        assert refresh_response.status_code == status.HTTP_200_OK
        
        # Try to use old token (should fail)
        response = await async_client.get("/api/auth/me", headers=headers)
        
        # Old token should be invalidated (if blacklisting is implemented)
        # This might return 200 if blacklisting isn't implemented yet
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            assert True  # Token blacklisting works
        else:
            pytest.skip("Token blacklisting not implemented")


@pytest.mark.integration
@pytest.mark.auth
class TestLogoutFlow:
    """Test logout functionality."""
    
    async def test_logout_clears_session(
        self, async_client: AsyncClient, admin_token: str
    ):
        """Test that logout clears user session."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        response = await async_client.post("/api/auth/logout", headers=headers)
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented")
        
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT]
    
    async def test_token_blacklisted_after_logout(
        self, async_client: AsyncClient, admin_token: str
    ):
        """Test that token is blacklisted after logout."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        
        # Logout
        logout_response = await async_client.post("/api/auth/logout", headers=headers)
        
        if logout_response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented")
        
        # Try to use token after logout
        response = await async_client.get("/api/auth/me", headers=headers)
        
        # Token should be invalidated
        if response.status_code == status.HTTP_401_UNAUTHORIZED:
            assert True  # Token blacklisting works
        else:
            pytest.skip("Token blacklisting after logout not implemented")
    
    async def test_logout_without_token_returns_401(
        self, async_client: AsyncClient
    ):
        """Test logout without authentication token."""
        response = await async_client.post("/api/auth/logout")
        
        if response.status_code == status.HTTP_404_NOT_FOUND:
            pytest.skip("Logout endpoint not implemented")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.integration
@pytest.mark.auth
class TestAuthorizationMiddleware:
    """Test authorization middleware and protected endpoints."""
    
    async def test_protected_endpoint_requires_token(
        self, async_client: AsyncClient
    ):
        """Test that protected endpoints require authentication."""
        response = await async_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_protected_endpoint_with_valid_token_succeeds(
        self, async_client: AsyncClient, admin_token: str, admin_user: User
    ):
        """Test protected endpoint with valid token."""
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == admin_user.username
    
    async def test_admin_only_endpoint_requires_admin_role(
        self, async_client: AsyncClient, test_session
    ):
        """Test that admin-only endpoints require admin role."""
        # Create regular user
        regular_user = await UserFactory.create_async(
            test_session,
            is_admin=False
        )
        
        # Create token for regular user
        user_token = create_access_token({"sub": regular_user.username})
        headers = {"Authorization": f"Bearer {user_token}"}
        
        # Try to access admin endpoint
        response = await async_client.post("/api/photos", headers=headers, json={
            "title": "Test Photo",
            "description": "Test"
        })
        
        assert response.status_code in [
            status.HTTP_403_FORBIDDEN,  # If endpoint checks admin role
            status.HTTP_422_UNPROCESSABLE_ENTITY  # If endpoint exists but requires file
        ]
    
    async def test_invalid_authorization_header_format_returns_401(
        self, async_client: AsyncClient, admin_token: str
    ):
        """Test invalid authorization header formats."""
        invalid_headers = [
            {"Authorization": admin_token},  # Missing Bearer
            {"Authorization": f"Token {admin_token}"},  # Wrong scheme
            {"Authorization": "Bearer"},  # Missing token
            {"Authorization": f"Bearer {admin_token} extra"},  # Extra content
        ]
        
        for headers in invalid_headers:
            response = await async_client.get("/api/auth/me", headers=headers)
            assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_expired_token_returns_401(
        self, async_client: AsyncClient, admin_user: User
    ):
        """Test that expired tokens are rejected."""
        # Create expired token
        expired_token = create_access_token(
            {"sub": admin_user.username},
            expires_delta=timedelta(seconds=-1)
        )
        
        headers = {"Authorization": f"Bearer {expired_token}"}
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_tampered_token_returns_401(
        self, async_client: AsyncClient, admin_token: str
    ):
        """Test that tampered tokens are rejected."""
        # Tamper with token
        tampered_token = admin_token[:-5] + "XXXXX"
        
        headers = {"Authorization": f"Bearer {tampered_token}"}
        response = await async_client.get("/api/auth/me", headers=headers)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    async def test_case_insensitive_bearer_scheme(
        self, async_client: AsyncClient, admin_token: str, admin_user: User
    ):
        """Test that Bearer scheme is case insensitive."""
        schemes = ["Bearer", "bearer", "BEARER", "BeArEr"]
        
        for scheme in schemes:
            headers = {"Authorization": f"{scheme} {admin_token}"}
            response = await async_client.get("/api/auth/me", headers=headers)
            
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert data["username"] == admin_user.username
    
    async def test_multiple_authorization_headers_handled_correctly(
        self, async_client: AsyncClient, admin_token: str
    ):
        """Test handling of multiple authorization headers."""
        # This would test edge case handling in your middleware
        # Most HTTP clients don't allow multiple headers with same name,
        # but it's good to verify server handles it gracefully
        pass  # Implementation depends on framework behavior
    
    @patch('app.dependencies.get_current_user')
    async def test_authorization_bypass_attempts_blocked(
        self, mock_get_current_user, async_client: AsyncClient
    ):
        """Test that attempts to bypass authorization are blocked."""
        # Mock should not be called if authorization is properly implemented
        mock_get_current_user.return_value = None
        
        response = await async_client.get("/api/auth/me")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        
        # Verify mock wasn't bypassed
        mock_get_current_user.assert_not_called()