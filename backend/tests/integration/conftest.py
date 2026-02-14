"""
Integration test configuration and fixtures.

These fixtures are specifically for integration tests that run against
the full stack in Docker Compose.
"""

from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Test fixture paths
FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
IMAGES_DIR = FIXTURES_DIR / "images"


@pytest.fixture
def fixture_images() -> dict[str, Path]:
    """Provide paths to test fixture images."""
    return {
        "landscape": IMAGES_DIR / "test-landscape.jpg",
        "portrait": IMAGES_DIR / "test-portrait.jpg",
        "square": IMAGES_DIR / "test-square.jpg",
        "small": IMAGES_DIR / "test-small.jpg",
        "large": IMAGES_DIR / "test-large.jpg",
        "with_exif": IMAGES_DIR / "test-with-exif.jpg",
    }


@pytest.fixture
def sample_image_path(fixture_images: dict[str, Path]) -> Path:
    """Return path to a sample landscape test image."""
    return fixture_images["landscape"]


@pytest.fixture
def sample_exif_image_path(fixture_images: dict[str, Path]) -> Path:
    """Return path to test image with EXIF data."""
    return fixture_images["with_exif"]


@pytest_asyncio.fixture
async def integration_engine():
    """
    Create an async engine for integration tests.

    Uses the same database as the running backend service.
    """
    database_url = os.getenv(
        "DATABASE_URL", "postgresql+asyncpg://testuser:testpassword@db:5432/testdb"
    )

    engine = create_async_engine(
        database_url,
        echo=False,
    )

    yield engine

    await engine.dispose()


@pytest.fixture
def integration_session_maker(integration_engine):
    """Return a session factory for integration tests."""
    return async_sessionmaker(
        integration_engine, class_=AsyncSession, expire_on_commit=False
    )


@pytest_asyncio.fixture
async def integration_session(
    integration_session_maker,
) -> AsyncGenerator[AsyncSession, None]:
    """Create an integration test database session."""
    async with integration_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def integration_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Create an async HTTP client for integration tests.

    This client connects to the backend service running in Docker.
    """
    backend_url = os.getenv("BACKEND_URL", "http://backend:8000")

    async with AsyncClient(base_url=backend_url, timeout=30.0) as client:
        yield client


@pytest_asyncio.fixture
async def admin_auth_headers(integration_client: AsyncClient) -> dict[str, str]:
    """
    Get authentication headers for admin user.

    Logs in as the integration admin user and returns the auth headers.
    """
    login_data = {
        "username": "integration_admin",
        "password": "TestPassword123!",  # Matches UserFactory default
    }

    response = await integration_client.post("/api/auth/login", data=login_data)

    if response.status_code != 200:
        msg = f"Failed to login admin user: {response.status_code} - {response.text}"
        raise RuntimeError(msg)

    data = response.json()
    access_token = data["access_token"]

    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def user_auth_headers(integration_client: AsyncClient) -> dict[str, str]:
    """
    Get authentication headers for regular user.

    Logs in as the integration regular user and returns the auth headers.
    """
    login_data = {
        "username": "integration_user",
        "password": "TestPassword123!",  # Matches UserFactory default
    }

    response = await integration_client.post("/api/auth/login", data=login_data)

    if response.status_code != 200:
        msg = f"Failed to login regular user: {response.status_code} - {response.text}"
        raise RuntimeError(msg)

    data = response.json()
    access_token = data["access_token"]

    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def authenticated_admin_client(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
) -> AsyncClient:
    """
    Create an authenticated async client with admin credentials.
    """
    integration_client.headers.update(admin_auth_headers)
    return integration_client


@pytest.fixture
def authenticated_user_client(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
) -> AsyncClient:
    """
    Create an authenticated async client with regular user credentials.
    """
    integration_client.headers.update(user_auth_headers)
    return integration_client


# Pytest markers for integration tests
def pytest_configure(config):
    """Configure custom pytest markers for integration tests."""
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests (requires full stack)"
    )
    config.addinivalue_line(
        "markers", "requires_fixtures: marks tests that require fixture images"
    )
