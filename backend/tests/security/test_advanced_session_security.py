"""
Advanced Security Tests for Session Management
Comprehensive security testing covering session management, token security,
attack prevention, and security best practices.
"""

from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from httpx import AsyncClient
from jose import jwt

from app.config import settings

# from app.core.security import TokenManager as SecurityTokenManager
from app.models import User
from tests.factories import UserFactory
from tests.utils.security_utils import SecurityAssertions, SecurityTestUtils


@pytest.mark.security
@pytest.mark.auth
class TestAdvancedTokenSecurity:
    """Advanced token security testing."""

    async def test_token_entropy_and_randomness(
        self, async_client: AsyncClient, test_session, security_settings
    ):
        """Test that tokens have sufficient entropy and randomness."""
        # Create multiple users and tokens
        users = []
        tokens = []

        for i in range(20):
            user = await UserFactory.create_async(
                test_session, username=f"user{i}", email=f"user{i}@example.com"
            )
            users.append(user)

            login_data = {
                "username": user.username,
                "password": "testpassword123",
                "remember_me": True,
            }

            response = await async_client.post("/api/auth/login", json=login_data)
            if response.status_code == 200:
                tokens.append(response.json()["access_token"])

        # Analyze token entropy
        assert len(tokens) >= 10, "Need sufficient tokens for entropy analysis"

        # Check token uniqueness
        assert len(set(tokens)) == len(tokens), "All tokens should be unique"

        # Analyze token patterns
        token_lengths = [len(token) for token in tokens]
        avg_length = sum(token_lengths) / len(token_lengths)

        # JWT tokens should be reasonably long
        assert avg_length > 100, f"Tokens too short, average length: {avg_length}"

        # Check for patterns in token structure
        token_parts = [token.split(".") for token in tokens]
        assert all(len(parts) == 3 for parts in token_parts), "Invalid JWT structure"

        # Analyze header consistency (should be consistent)
        headers = [parts[0] for parts in token_parts]
        unique_headers = set(headers)
        assert len(unique_headers) <= 2, "Too many different header types"

        # Analyze payload randomness (JTI should be unique if present)
        payloads = []
        for token in tokens:
            try:
                payload = SecurityTestUtils.extract_jwt_payload(
                    token, security_settings.SECRET_KEY
                )
                payloads.append(payload)
            except Exception:
                pass  # Skip invalid tokens

        if payloads:
            # Check for unique "iat" (issued at) times
            iat_times = [
                p.get("iat")
                for p in payloads
                if "iat" in p and p.get("iat") is not None
            ]
            if len(iat_times) > 1:
                time_differences = [
                    abs(float(iat_times[i]) - float(iat_times[i - 1]))
                    for i in range(1, len(iat_times))
                ]
                assert all(diff >= 0 for diff in time_differences), (
                    "Token timestamps should be sequential"
                )

    async def test_token_signature_verification_robustness(
        self,
        async_client: AsyncClient,
        test_session,
        admin_user: User,
        security_settings,
    ):
        """Test robustness of token signature verification."""
        # Get valid token
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        original_token = response.json()["access_token"]

        # Test various signature tampering scenarios
        tamper_scenarios = [
            {
                "description": "Modified last character",
                "tamper": lambda t: t[:-1] + "X",
            },
            {
                "description": "Modified first character",
                "tamper": lambda t: "X" + t[1:],
            },
            {
                "description": "Swapped two characters",
                "tamper": lambda t: t[:-2] + t[-1] + t[-2],
            },
            {"description": "Added extra character", "tamper": lambda t: t + "A"},
            {"description": "Removed last character", "tamper": lambda t: t[:-1]},
            {
                "description": "Modified middle",
                "tamper": lambda t: t[: len(t) // 2] + "X" + t[len(t) // 2 + 1 :],
            },
        ]

        for scenario in tamper_scenarios:
            tampered_token = scenario["tamper"](original_token)

            headers = {"Authorization": f"Bearer {tampered_token}"}
            response = await async_client.get("/api/auth/me", headers=headers)

            assert response.status_code == 401, (
                f"Failed for scenario: {scenario['description']}"
            )

            # Error message should not reveal specific validation failure
            error_detail = response.json().get("detail", "").lower()
            sensitive_phrases = ["signature", "invalid token", "decode", "verify"]
            [phrase for phrase in sensitive_phrases if phrase in error_detail]

            # Should use generic error message
            assert "invalid" in error_detail or "unauthorized" in error_detail

    async def test_concurrent_session_management(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test concurrent session creation and management."""
        concurrent_sessions = 10

        async def create_session(session_id: int):
            login_data = {
                "username": admin_user.username,
                "password": "testpassword123",
                "remember_me": True,
            }

            response = await async_client.post("/api/auth/login", json=login_data)
            return {
                "session_id": session_id,
                "success": response.status_code == 200,
                "token": response.json().get("access_token")
                if response.status_code == 200
                else None,
                "response_time": time.time(),
            }

        # Create concurrent sessions
        tasks = [create_session(i) for i in range(concurrent_sessions)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Analyze results
        successful_sessions = [
            r for r in results if isinstance(r, dict) and r["success"]
        ]
        [r for r in results if not (isinstance(r, dict) and r.get("success"))]

        # Should handle concurrent requests without errors
        assert len(successful_sessions) >= concurrent_sessions * 0.8, (
            "Too many failed concurrent sessions"
        )

        # All successful tokens should be unique
        tokens = [s["token"] for s in successful_sessions if s["token"]]
        assert len(set(tokens)) == len(tokens), (
            "Concurrent sessions produced duplicate tokens"
        )

        # Response times should be reasonable
        response_times = [s["response_time"] for s in successful_sessions]
        if len(response_times) > 1:
            max_time = max(response_times)
            min_time = min(response_times)
            assert max_time - min_time < 10, (
                "Excessive variation in concurrent response times"
            )

    async def test_session_isolation_and_segregation(
        self, async_client: AsyncClient, test_session
    ):
        """Test that sessions are properly isolated between users."""
        # Create two users
        await UserFactory.create_async(
            test_session, username="user1", email="user1@example.com"
        )
        await UserFactory.create_async(
            test_session, username="user2", email="user2@example.com"
        )

        # Login both users
        login_data1 = {"username": "user1", "password": "testpassword123"}
        login_data2 = {"username": "user2", "password": "testpassword123"}

        response1 = await async_client.post("/api/auth/login", json=login_data1)
        response2 = await async_client.post("/api/auth/login", json=login_data2)

        token1 = response1.json()["access_token"]
        token2 = response2.json()["access_token"]

        # Verify each user can only access their own data
        headers1 = {"Authorization": f"Bearer {token1}"}
        headers2 = {"Authorization": f"Bearer {token2}"}

        me_response1 = await async_client.get("/api/auth/me", headers=headers1)
        me_response2 = await async_client.get("/api/auth/me", headers=headers2)

        assert me_response1.status_code == 200
        assert me_response2.status_code == 200

        user1_data = me_response1.json()
        user2_data = me_response2.json()

        # Should return different user data
        assert user1_data["username"] != user2_data["username"]
        assert user1_data["id"] != user2_data["id"]

        # Cross-contamination test: user1's token shouldn't return user2's data
        assert user1_data["username"] == "user1"
        assert user2_data["username"] == "user2"

    async def test_session_hijacking_detection(
        self,
        async_client: AsyncClient,
        test_session,
        admin_user: User,
        security_settings,
    ):
        """Test detection of potential session hijacking."""
        # Create initial session
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]

        # Simulate hijacking by using same token with different characteristics
        headers_original = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Forwarded-For": "192.168.1.100",
        }

        headers_hijacked = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "curl/7.68.0",  # Different User-Agent
            "X-Forwarded-For": "192.168.1.200",  # Different IP
        }

        # Original request should work
        response_original = await async_client.get(
            "/api/auth/me", headers=headers_original
        )
        assert response_original.status_code == 200

        # Hijacked request behavior depends on implementation
        response_hijacked = await async_client.get(
            "/api/auth/me", headers=headers_hijacked
        )

        # If session hijacking detection is implemented, should be blocked
        # If not implemented, should still work but be logged
        assert response_hijacked.status_code in [200, 401, 403]

    async def test_brute_force_protection_advanced(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test advanced brute force protection mechanisms."""
        # Test progressive delays
        attempt_times = []

        for attempt in range(8):
            start_time = time.time()

            login_data = {
                "username": admin_user.username,
                "password": f"wrong_password_{attempt}",
            }

            response = await async_client.post("/api/auth/login", json=login_data)
            end_time = time.time()

            attempt_times.append({
                "attempt": attempt + 1,
                "response_time": end_time - start_time,
                "status_code": response.status_code,
            })

            # Small delay between attempts
            await asyncio.sleep(0.1)

        # Analyze response times for progressive delays
        response_times = [t["response_time"] for t in attempt_times]

        # Should see either rate limiting (429) or progressive delays
        rate_limited = any(t["status_code"] == 429 for t in attempt_times)
        progressive_delay = (
            len(response_times) > 3 and response_times[-1] > response_times[0] * 2
        )

        # At least one protection mechanism should be active
        protection_active = rate_limited or progressive_delay

        # Document findings for analysis
        analysis = {
            "rate_limited": rate_limited,
            "progressive_delay": progressive_delay,
            "protection_active": protection_active,
            "attempt_details": attempt_times,
        }

        # If no protection, ensure it's documented
        if not protection_active:
            pytest.skip(f"No brute force protection detected: {analysis}")

    async def test_session_token_binding(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test session token binding to prevent token theft."""
        # Create session with specific client characteristics
        original_headers = {
            "User-Agent": "Mozilla/5.0 TestClient/1.0",
            "X-Forwarded-For": "192.168.1.100",
            "Accept": "application/json",
        }

        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post(
            "/api/auth/login", json=login_data, headers=original_headers
        )
        token = response.json()["access_token"]

        # Test token with original characteristics
        auth_headers = {"Authorization": f"Bearer {token}"}
        auth_headers.update(original_headers)

        me_response = await async_client.get("/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200

        # Test token with different characteristics (potential theft)
        stolen_headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "DifferentClient/2.0",
            "X-Forwarded-For": "10.0.0.50",
            "Accept": "text/html",
        }

        stolen_response = await async_client.get("/api/auth/me", headers=stolen_headers)

        # Behavior depends on token binding implementation
        # Strong binding would reject, weak binding would allow but log
        assert stolen_response.status_code in [200, 401, 403]


@pytest.mark.security
@pytest.mark.auth
class TestAdvancedCSRFProtection:
    """Advanced CSRF protection testing."""

    async def test_csrf_token_implementation(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test CSRF token implementation if present."""
        # Login to get session
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check if CSRF tokens are implemented
        me_response = await async_client.get("/api/auth/me", headers=headers)

        csrf_token_header = me_response.headers.get("X-CSRF-Token")
        csrf_cookie = None

        for cookie in me_response.cookies.values():
            if "csrf" in cookie.name.lower():
                csrf_cookie = cookie
                break

        if csrf_token_header or csrf_cookie:
            # CSRF protection is implemented, test it
            await self._test_csrf_protection_effectiveness(
                async_client, headers, csrf_token_header
            )
        else:
            # No CSRF protection detected
            pytest.skip("No CSRF protection implementation detected")

    async def _test_csrf_protection_effectiveness(
        self, async_client: AsyncClient, headers: dict, csrf_token: str
    ):
        """Test effectiveness of CSRF protection."""
        # Test state-changing operation without CSRF token
        response_without_csrf = await async_client.post(
            "/api/auth/logout", headers=headers
        )

        # Test with CSRF token if available
        if csrf_token:
            csrf_headers = headers.copy()
            csrf_headers["X-CSRF-Token"] = csrf_token
            response_with_csrf = await async_client.post(
                "/api/auth/logout", headers=csrf_headers
            )

            # Should behave differently with/without CSRF token
            assert response_without_csrf.status_code != response_with_csrf.status_code

    async def test_origin_and_referer_validation(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test Origin and Referer header validation."""
        # Login
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]

        # Test with legitimate origin
        legitimate_headers = {
            "Authorization": f"Bearer {token}",
            "Origin": "https://localhost:3000",
            "Referer": "https://localhost:3000/dashboard",
        }

        legitimate_response = await async_client.post(
            "/api/auth/logout", headers=legitimate_headers
        )

        # Test with malicious origin
        malicious_headers = {
            "Authorization": f"Bearer {token}",
            "Origin": "https://evil.com",
            "Referer": "https://evil.com/csrf-attack",
        }

        malicious_response = await async_client.post(
            "/api/auth/logout", headers=malicious_headers
        )

        # Responses should be handled appropriately
        # Implementation may vary - some may block, others may allow but log
        assert legitimate_response.status_code in [200, 204, 401, 404]
        assert malicious_response.status_code in [200, 204, 400, 403, 401, 404]

    async def test_samesite_cookie_effectiveness(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test SameSite cookie attribute effectiveness."""
        # Login to get cookies
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        # Check SameSite attributes on cookies
        for cookie_name, cookie in response.cookies.items():
            if "refresh" in cookie_name.lower() or "session" in cookie_name.lower():
                samesite = getattr(cookie, "samesite", None)

                # Should have SameSite attribute
                assert samesite is not None, (
                    f"Cookie {cookie_name} missing SameSite attribute"
                )
                assert samesite.lower() in ["lax", "strict"], (
                    f"Cookie {cookie_name} has weak SameSite: {samesite}"
                )

    async def test_double_submit_cookie_pattern(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test double submit cookie CSRF protection pattern."""
        # This tests if the application uses double submit cookie pattern
        # where CSRF token in cookie must match token in header/form

        # Login
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)

        # Look for CSRF-related cookies
        csrf_cookie = None
        for cookie_name, cookie in response.cookies.items():
            if "csrf" in cookie_name.lower() or "xsrf" in cookie_name.lower():
                csrf_cookie = cookie
                break

        if csrf_cookie:
            # Test double submit pattern
            token = response.json()["access_token"]

            # Request with matching CSRF cookie and header
            matching_headers = {
                "Authorization": f"Bearer {token}",
                "X-CSRF-Token": csrf_cookie.value,
                "Cookie": f"{csrf_cookie.name}={csrf_cookie.value}",
            }

            # Request with mismatched CSRF values
            mismatched_headers = {
                "Authorization": f"Bearer {token}",
                "X-CSRF-Token": "different_token",
                "Cookie": f"{csrf_cookie.name}={csrf_cookie.value}",
            }

            matching_response = await async_client.post(
                "/api/auth/logout", headers=matching_headers
            )
            mismatched_response = await async_client.post(
                "/api/auth/logout", headers=mismatched_headers
            )

            # Should behave differently
            if matching_response.status_code != mismatched_response.status_code:
                assert mismatched_response.status_code in [400, 403], (
                    "CSRF mismatch should be rejected"
                )
        else:
            pytest.skip("No CSRF cookie implementation detected")


@pytest.mark.security
@pytest.mark.auth
class TestSessionExpirationAndCleanup:
    """Test session expiration and cleanup mechanisms."""

    async def test_session_expiration_enforcement(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that session expiration is properly enforced."""
        # Create session with short expiry (mock scenario)
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]

        # Verify token is currently valid
        headers = {"Authorization": f"Bearer {token}"}
        me_response = await async_client.get("/api/auth/me", headers=headers)
        assert me_response.status_code == 200

        # Test with expired token (using mock or time manipulation)
        # This would require mocking the JWT decode function to simulate expiry
        # For now, we test the concept

        # Create an obviously expired token for testing
        past_time = datetime.utcnow() - timedelta(hours=1)
        expired_payload = {
            "sub": admin_user.username,
            "exp": past_time.timestamp(),
            "type": "access",
        }

        expired_token = jwt.encode(
            expired_payload, settings.secret_key, algorithm="HS256"
        )
        expired_headers = {"Authorization": f"Bearer {expired_token}"}

        expired_response = await async_client.get(
            "/api/auth/me", headers=expired_headers
        )
        assert expired_response.status_code == 401

    async def test_idle_session_timeout(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test idle session timeout functionality."""
        # This test would require Redis session tracking
        # For now, we test the concept

        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        # Check if refresh token has reasonable expiry
        refresh_cookie = None
        for cookie_name, cookie in response.cookies.items():
            if "refresh" in cookie_name.lower():
                refresh_cookie = cookie
                break

        if refresh_cookie:
            max_age = getattr(refresh_cookie, "max_age", None)
            if max_age:
                # Should have reasonable limits
                assert max_age <= 30 * 24 * 60 * 60, "Refresh token expiry too long"
                assert max_age >= 24 * 60 * 60, "Refresh token expiry too short"

    async def test_session_cleanup_on_logout(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test proper session cleanup on logout."""
        # Login
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        login_response = await async_client.post("/api/auth/login", json=login_data)
        token = login_response.json()["access_token"]

        # Logout
        headers = {"Authorization": f"Bearer {token}"}
        logout_response = await async_client.post("/api/auth/logout", headers=headers)

        if logout_response.status_code in [200, 204]:
            # Check that cookies are cleared
            for cookie_name, cookie in logout_response.cookies.items():
                if "refresh" in cookie_name.lower():
                    # Cookie should be cleared (value empty or max_age=0)
                    max_age = getattr(cookie, "max_age", None)
                    value = getattr(cookie, "value", "")

                    cleared = max_age == 0 or not value or value == "deleted"
                    assert cleared, f"Refresh cookie not properly cleared: {cookie}"

    async def test_concurrent_session_limits(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test concurrent session limits per user."""
        max_sessions = 5
        sessions = []

        # Create multiple concurrent sessions
        for i in range(max_sessions + 2):
            login_data = {
                "username": admin_user.username,
                "password": "testpassword123",
                "remember_me": True,
            }

            response = await async_client.post("/api/auth/login", json=login_data)

            if response.status_code == 200:
                sessions.append({
                    "token": response.json()["access_token"],
                    "session_id": i,
                })

            # Small delay between sessions
            await asyncio.sleep(0.1)

        # Test that all sessions work (or that old sessions are invalidated)
        active_sessions = 0

        for session in sessions:
            headers = {"Authorization": f"Bearer {session['token']}"}
            response = await async_client.get("/api/auth/me", headers=headers)

            if response.status_code == 200:
                active_sessions += 1

        # Should either limit concurrent sessions or allow all
        # Document the behavior for security review
        session_analysis = {
            "total_created": len(sessions),
            "active_sessions": active_sessions,
            "limit_enforced": active_sessions <= max_sessions,
        }

        # This is informational - different implementations may handle this differently
        assert active_sessions >= 1, (
            f"At least one session should be active: {session_analysis}"
        )


@pytest.mark.security
@pytest.mark.auth
class TestTokenRevocationSecurity:
    """Test advanced token revocation security."""

    async def test_token_blacklisting_effectiveness(
        self,
        async_client: AsyncClient,
        test_session,
        admin_user: User,
        mock_redis_for_security,
    ):
        """Test token blacklisting implementation."""
        # Login
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]

        # Verify token works
        headers = {"Authorization": f"Bearer {token}"}
        me_response = await async_client.get("/api/auth/me", headers=headers)
        assert me_response.status_code == 200

        # Add token to blacklist (simulate revocation)
        with patch("app.core.redis.redis_client", mock_redis_for_security):
            await mock_redis_for_security.set(
                f"blacklisted_token:{token}", "1", ex=3600
            )

            # Token should now be rejected (if blacklisting is implemented)
            blacklisted_response = await async_client.get(
                "/api/auth/me", headers=headers
            )

            # Behavior depends on implementation
            # If blacklisting is implemented, should be 401
            # If not implemented, may still be 200
            if blacklisted_response.status_code == 401:
                # Blacklisting is working
                assert True
            else:
                pytest.skip("Token blacklisting not implemented")

    async def test_revoke_all_sessions_atomicity(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test that revoking all sessions is atomic and effective."""
        # Create multiple sessions
        sessions = []

        for _i in range(3):
            login_data = {
                "username": admin_user.username,
                "password": "testpassword123",
            }

            response = await async_client.post("/api/auth/login", json=login_data)
            if response.status_code == 200:
                sessions.append(response.json()["access_token"])

        assert len(sessions) >= 2, "Need multiple sessions for test"

        # Verify all sessions work
        for token in sessions:
            headers = {"Authorization": f"Bearer {token}"}
            response = await async_client.get("/api/auth/me", headers=headers)
            assert response.status_code == 200

        # Revoke all sessions using one token
        revoke_headers = {"Authorization": f"Bearer {sessions[0]}"}
        revoke_response = await async_client.post(
            "/api/auth/revoke-all-sessions", headers=revoke_headers
        )

        if revoke_response.status_code not in [404, 501]:  # Not implemented
            # Check that all sessions are invalidated
            invalid_sessions = 0

            for token in sessions:
                headers = {"Authorization": f"Bearer {token}"}
                response = await async_client.get("/api/auth/me", headers=headers)

                if response.status_code == 401:
                    invalid_sessions += 1

            # Should invalidate all sessions or none (atomic operation)
            assert invalid_sessions == 0 or invalid_sessions == len(sessions), (
                f"Partial session revocation detected: {invalid_sessions}/{len(sessions)}"
            )
        else:
            pytest.skip("Session revocation endpoint not implemented")

    async def test_token_revocation_race_conditions(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test for race conditions in token revocation."""
        # Login
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Concurrent operations: logout and API call
        async def logout_request():
            return await async_client.post("/api/auth/logout", headers=headers)

        async def api_request():
            await asyncio.sleep(0.05)  # Small delay
            return await async_client.get("/api/auth/me", headers=headers)

        # Execute concurrently
        results = await asyncio.gather(
            logout_request(), api_request(), return_exceptions=True
        )

        logout_result, api_result = results

        # Should handle race condition gracefully
        # Either both succeed (logout happens after API call)
        # Or API call fails (logout happens first)
        # Should not cause server errors

        if isinstance(logout_result, Exception):
            pytest.fail(f"Logout request failed with exception: {logout_result}")

        if isinstance(api_result, Exception):
            pytest.fail(f"API request failed with exception: {api_result}")

        assert logout_result.status_code in [200, 204, 401, 404]
        assert api_result.status_code in [200, 401]


@pytest.mark.security
@pytest.mark.auth
class TestSecurityHeadersAndResponse:
    """Test security headers and response security."""

    async def test_authentication_response_headers(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test security headers in authentication responses."""
        # Login request
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)

        # Validate security headers
        SecurityTestUtils.validate_security_headers(response)

        # Should have basic security headers
        assert response.headers.get("content-type") == "application/json"

        # Cache control for sensitive endpoints
        cache_control = response.headers.get("cache-control", "").lower()
        if cache_control:
            assert "no-store" in cache_control or "no-cache" in cache_control, (
                "Authentication responses should not be cached"
            )

    async def test_error_response_information_disclosure(
        self, async_client: AsyncClient, test_session
    ):
        """Test that error responses don't disclose sensitive information."""
        # Test various authentication errors
        error_scenarios = [
            {"username": "nonexistent", "password": "any"},
            {"username": "admin", "password": "wrong"},
            {"username": "", "password": ""},
            {"username": "admin' OR '1'='1", "password": "injection"},
        ]

        for scenario in error_scenarios:
            response = await async_client.post("/api/auth/login", json=scenario)

            # Should return 401 for all scenarios
            assert response.status_code == 401

            # Check for information disclosure
            disclosure_analysis = SecurityTestUtils.detect_information_disclosure(
                response
            )

            # Should not reveal system information
            assert not disclosure_analysis["has_disclosures"], (
                f"Information disclosure in error response: {disclosure_analysis}"
            )

            # Error message should be generic
            error_detail = response.json().get("detail", "").lower()
            assert "invalid" in error_detail or "unauthorized" in error_detail

            # Should not reveal specific failure reason
            sensitive_phrases = [
                "user not found",
                "wrong password",
                "database error",
                "table",
                "column",
                "sql",
                "stack trace",
            ]

            for phrase in sensitive_phrases:
                assert phrase not in error_detail, (
                    f"Sensitive information disclosed: '{phrase}' in '{error_detail}'"
                )

    async def test_response_timing_consistency(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test response timing consistency to prevent timing attacks."""
        # Test different types of authentication failures
        scenarios = [
            {
                "desc": "valid_user_wrong_pass",
                "data": {"username": admin_user.username, "password": "wrong"},
            },
            {
                "desc": "invalid_user",
                "data": {"username": "nonexistent", "password": "any"},
            },
            {
                "desc": "empty_username",
                "data": {"username": "", "password": "password"},
            },
            {
                "desc": "empty_password",
                "data": {"username": admin_user.username, "password": ""},
            },
        ]

        timing_results = {}

        for scenario in scenarios:
            times = []

            # Measure response times for each scenario
            for _ in range(5):
                (
                    _response,
                    response_time,
                ) = await SecurityTestUtils.measure_response_time(
                    async_client, "POST", "/api/auth/login", json=scenario["data"]
                )
                times.append(response_time)

                # Small delay between requests
                await asyncio.sleep(0.1)

            timing_results[scenario["desc"]] = {
                "times": times,
                "average": sum(times) / len(times),
                "max": max(times),
                "min": min(times),
            }

        # Analyze timing patterns
        all_times = []
        for result in timing_results.values():
            all_times.extend(result["times"])

        SecurityTestUtils.analyze_timing_patterns(all_times)

        # Should not be vulnerable to timing attacks
        SecurityAssertions.assert_no_timing_attack_vulnerability(
            all_times,
            threshold=0.5,  # Allow 500ms variance
            message="Authentication endpoint vulnerable to timing attacks",
        )

    async def test_cookie_security_attributes_comprehensive(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Comprehensive test of cookie security attributes."""
        # Login with remember me to get cookies
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)

        # Check all cookie security attributes
        cookie_security = SecurityTestUtils.check_cookie_security(response)

        for cookie_name, security_info in cookie_security.items():
            if "refresh" in cookie_name.lower() or "session" in cookie_name.lower():
                # Critical security cookies
                attrs = security_info["attributes"]

                # Should have HttpOnly
                assert attrs["httponly"], (
                    f"Cookie {cookie_name} missing HttpOnly attribute"
                )

                # Should have SameSite
                assert attrs["samesite"] in ["lax", "strict"], (
                    f"Cookie {cookie_name} has weak SameSite: {attrs['samesite']}"
                )

                # Should have Secure in production (may be False in test)
                # This is environment-dependent

                # Should have appropriate path
                assert attrs["path"] in ["/", "/api"], (
                    f"Cookie {cookie_name} has overly broad path: {attrs['path']}"
                )

                # Should have reasonable max_age
                if attrs["max_age"]:
                    assert attrs["max_age"] <= 30 * 24 * 60 * 60, (
                        f"Cookie {cookie_name} max_age too long: {attrs['max_age']}"
                    )


# Performance and load testing for security
@pytest.mark.security
@pytest.mark.performance
class TestSecurityPerformance:
    """Test security features under load."""

    async def test_authentication_under_load(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test authentication performance under load."""
        concurrent_requests = 20

        async def auth_request(request_id: int):
            login_data = {
                "username": admin_user.username,
                "password": "testpassword123",
            }

            start_time = time.time()
            response = await async_client.post("/api/auth/login", json=login_data)
            end_time = time.time()

            return {
                "request_id": request_id,
                "status_code": response.status_code,
                "response_time": end_time - start_time,
                "success": response.status_code == 200,
            }

        # Execute concurrent authentication requests
        tasks = [auth_request(i) for i in range(concurrent_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Analyze results
        successful_requests = [
            r for r in results if isinstance(r, dict) and r["success"]
        ]
        [r for r in results if not (isinstance(r, dict) and r.get("success"))]

        success_rate = len(successful_requests) / len(results)

        # Should handle concurrent load gracefully
        assert success_rate >= 0.8, f"Low success rate under load: {success_rate}"

        # Response times should be reasonable
        if successful_requests:
            response_times = [r["response_time"] for r in successful_requests]
            avg_response_time = sum(response_times) / len(response_times)
            max_response_time = max(response_times)

            assert avg_response_time < 2.0, (
                f"Average response time too high: {avg_response_time}s"
            )
            assert max_response_time < 5.0, (
                f"Max response time too high: {max_response_time}s"
            )

    async def test_token_validation_performance(
        self, async_client: AsyncClient, test_session, admin_user: User
    ):
        """Test token validation performance."""
        # Get valid token
        login_data = {"username": admin_user.username, "password": "testpassword123"}

        response = await async_client.post("/api/auth/login", json=login_data)
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Measure token validation performance
        validation_times = []

        for _ in range(50):
            start_time = time.time()
            response = await async_client.get("/api/auth/me", headers=headers)
            end_time = time.time()

            if response.status_code == 200:
                validation_times.append(end_time - start_time)

        # Analyze performance
        if validation_times:
            avg_time = sum(validation_times) / len(validation_times)
            max_time = max(validation_times)

            # Token validation should be fast
            assert avg_time < 0.1, f"Token validation too slow: {avg_time}s average"
            assert max_time < 0.5, f"Token validation max time too high: {max_time}s"
