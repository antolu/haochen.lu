from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from fastapi import status

from app.config import settings as static_settings
from app.core.runtime_settings import get_image_settings

if TYPE_CHECKING:
    from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_settings_anonymous(async_client: AsyncClient) -> None:
    """Unauthenticated users cannot access settings."""
    response = await async_client.get("/api/settings")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_get_settings_admin(authenticated_client: AsyncClient) -> None:
    """Admin users can retrieve system settings."""
    response = await authenticated_client.get("/api/settings")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "responsive_sizes" in data
    assert "quality_settings" in data
    assert "webp_quality" in data
    assert "rate_limit_enabled" in data
    assert "rate_limit_calls" in data
    assert "rate_limit_locked" in data
    assert data["rate_limit_locked"] is False  # default for tests unless mocked


@pytest.mark.asyncio
async def test_update_settings_success(authenticated_client: AsyncClient) -> None:
    """Admin users can update settings successfully."""
    payload = {
        "webp_quality": 88,
        "rate_limit_enabled": False,
        "rate_limit_calls": 150,
    }
    response = await authenticated_client.put("/api/settings", json=payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["webp_quality"] == 88
    assert data["rate_limit_enabled"] is False
    assert data["rate_limit_calls"] == 150

    # Verify that in-memory cache is updated
    settings = get_image_settings()
    assert settings.webp_quality == 88
    assert settings.rate_limit_enabled is False
    assert settings.rate_limit_calls == 150


@pytest.mark.asyncio
async def test_update_settings_rate_limit_locked(
    authenticated_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cannot change rate_limit_enabled if locked by the environment."""
    # Mock is_rate_limit_env_set to return True and rate_limit_enabled to True
    monkeypatch.setattr(
        static_settings.__class__, "is_rate_limit_env_set", property(lambda self: True)
    )
    monkeypatch.setattr(static_settings, "rate_limit_enabled", True)

    # Re-verify that in-memory settings returns locked value
    settings = get_image_settings()
    assert settings.rate_limit_enabled is True

    # Try to disable it -> should fail
    payload = {
        "rate_limit_enabled": False,
    }
    response = await authenticated_client.put("/api/settings", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "locked" in response.json()["detail"]

    # Try to keep it as True -> should succeed
    payload = {
        "rate_limit_enabled": True,
        "webp_quality": 90,
    }
    response = await authenticated_client.put("/api/settings", json=payload)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["webp_quality"] == 90
