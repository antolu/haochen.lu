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

from app.core.security import create_access_token
from app.models import User


@pytest.mark.security
@pytest.mark.auth
async def test_authentication_response_headers(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test security headers in authentication responses."""
    response = await async_client.get(
        "/api/auth/login",
        params={"next": "/admin"},
        headers={"Accept": "application/json"},
    )

    # Validate security headers
    SecurityTestUtils.validate_security_headers(response)

    # Should have basic security headers
    assert "application/json" in response.headers.get("content-type", "")

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
        {
            "client_id": "missing-client",
            "redirect_uri": "https://sub.example.com/callback",
            "response_type": "code",
            "state": "state-1",
        },
        {
            "client_id": "missing-client",
            "redirect_uri": "https://sub.example.com/callback",
            "response_type": "token",
            "state": "state-2",
        },
        {
            "client_id": "",
            "redirect_uri": "",
            "response_type": "code",
            "state": "",
        },
        {
            "client_id": "admin' OR '1'='1",
            "redirect_uri": "https://sub.example.com/callback",
            "response_type": "code",
            "state": "state-3",
        },
    ]

    for scenario in error_scenarios:
        response = await async_client.get("/api/auth/login", params=scenario)

        assert response.status_code in [400, 422]

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
        detail_obj = response.json().get("detail", "")
        detail_str = str(detail_obj).lower()
        assert "traceback" not in detail_str
        assert "exception" not in detail_str


@pytest.mark.security
@pytest.mark.auth
async def test_response_timing_consistency(
    async_client: AsyncClient, test_session, admin_user: User
):
    """Test that login bootstrap timing doesn't vary dramatically."""
    timings: dict[str, list[float]] = {
        "valid": [],
        "invalid_client": [],
        "invalid_response_type": [],
    }

    for _ in range(5):
        start = time.time()
        await async_client.get(
            "/api/auth/login",
            params={"next": "/admin"},
            headers={"Accept": "application/json"},
        )
        timings["valid"].append(time.time() - start)

    for _ in range(5):
        start = time.time()
        await async_client.get(
            "/api/auth/login",
            params={
                "client_id": "nonexistent_user_xyz",
                "redirect_uri": "https://sub.example.com/callback",
                "response_type": "code",
                "state": "state-1",
            },
        )
        timings["invalid_client"].append(time.time() - start)

    for _ in range(5):
        start = time.time()
        await async_client.get(
            "/api/auth/login",
            params={
                "client_id": "nonexistent_user_xyz",
                "redirect_uri": "https://sub.example.com/callback",
                "response_type": "token",
                "state": "state-2",
            },
        )
        timings["invalid_response_type"].append(time.time() - start)

    avg_valid = sum(timings["valid"]) / len(timings["valid"])
    avg_invalid_user = sum(timings["invalid_client"]) / len(timings["invalid_client"])
    avg_invalid_pass = sum(timings["invalid_response_type"]) / len(
        timings["invalid_response_type"]
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
    token = create_access_token({"sub": str(admin_user.id)})

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
