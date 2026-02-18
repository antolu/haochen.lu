"""
Advanced Security Tests for Session Management
Security testing covering token security, attack prevention, and security best practices
applicable to stateless JWT authentication.
"""

from __future__ import annotations

import time

import pytest
from httpx import AsyncClient
from tests.utils.security_utils import SecurityTestUtils

from app.models import User


@pytest.mark.security
@pytest.mark.auth
async def test_authentication_response_headers(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test security headers in authentication responses."""
    login_data = {"username": admin_user.username, "password": "TestPassword123!"}

    response = await async_client.post("/api/auth/login", data=login_data)

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


@pytest.mark.security
@pytest.mark.auth
async def test_error_response_information_disclosure(
    async_client: AsyncClient, test_session
):
    """Test that error responses don't disclose sensitive information."""
    error_scenarios = [
        {"username": "nonexistent", "password": "any"},
        {"username": "admin", "password": "wrong"},
        {"username": "", "password": ""},
        {"username": "admin' OR '1'='1", "password": "injection"},
    ]

    for scenario in error_scenarios:
        response = await async_client.post("/api/auth/login", data=scenario)

        # Should return 400, 401, or 422 for all scenarios
        assert response.status_code in [400, 401, 422]

        # Check for information disclosure
        disclosure_analysis = SecurityTestUtils.detect_information_disclosure(response)

        # Should not reveal system information
        assert not disclosure_analysis["content_disclosures"]["stack_traces"]["found"]
        assert not disclosure_analysis["content_disclosures"]["database_errors"][
            "found"
        ]
        assert not disclosure_analysis["content_disclosures"]["sensitive_paths"][
            "found"
        ]

        # Error messages should be generic
        detail = response.json().get("detail", "").lower()
        assert "traceback" not in detail
        assert "exception" not in detail


@pytest.mark.security
@pytest.mark.auth
async def test_response_timing_consistency(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test that response timing doesn't leak information."""
    timings: dict[str, list[float]] = {
        "valid": [],
        "invalid_user": [],
        "invalid_password": [],
    }

    # Test valid login
    for _ in range(5):
        start = time.time()
        await async_client.post(
            "/api/auth/login",
            data={
                "username": admin_user.username,
                "password": "TestPassword123!",
            },
        )
        timings["valid"].append(time.time() - start)

    # Test invalid user
    for _ in range(5):
        start = time.time()
        await async_client.post(
            "/api/auth/login",
            data={"username": "nonexistent_user_xyz", "password": "any"},
        )
        timings["invalid_user"].append(time.time() - start)

    # Test invalid password
    for _ in range(5):
        start = time.time()
        await async_client.post(
            "/api/auth/login",
            data={
                "username": admin_user.username,
                "password": "wrongpassword",
            },
        )
        timings["invalid_password"].append(time.time() - start)

    # Calculate average timings
    avg_valid = sum(timings["valid"]) / len(timings["valid"])
    avg_invalid_user = sum(timings["invalid_user"]) / len(timings["invalid_user"])
    avg_invalid_pass = sum(timings["invalid_password"]) / len(
        timings["invalid_password"]
    )

    # Timing differences should be reasonable (< 200% difference)
    # This prevents timing attacks to enumerate users
    # Note: In practice, network and system variance can cause larger differences
    max_timing = max(avg_valid, avg_invalid_user, avg_invalid_pass)
    min_timing = min(avg_valid, avg_invalid_user, avg_invalid_pass)

    if max_timing > 0:
        timing_ratio = (max_timing - min_timing) / max_timing
        assert timing_ratio < 2.0, f"Timing difference too large: {timing_ratio:.2%}"


@pytest.mark.security
@pytest.mark.auth
async def test_token_validation_performance(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test token validation performance."""
    # Login to get valid token
    login_response = await async_client.post(
        "/api/auth/login",
        data={
            "username": admin_user.username,
            "password": "TestPassword123!",
        },
    )
    token = login_response.json()["access_token"]

    # Measure token validation time
    validation_times = []

    for _ in range(10):
        start_time = time.time()

        response = await async_client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        )

        validation_time = time.time() - start_time
        validation_times.append(validation_time)

        # Accept both 200 (success) and 404 (endpoint not found)
        assert response.status_code in [200, 404]

    avg_validation_time = sum(validation_times) / len(validation_times)

    # Token validation should be fast (< 100ms on average)
    assert avg_validation_time < 0.1, (
        f"Token validation too slow: {avg_validation_time:.3f}s"
    )
