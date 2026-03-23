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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import create_access_token
from app.models.user import User

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
async def admin_auth_headers(integration_session: AsyncSession) -> dict[str, str]:
    result = await integration_session.execute(
        select(User).where(User.username == "integration_admin")
    )
    admin_user = result.scalar_one_or_none()
    if admin_user is None:
        msg = "Integration admin user not found"
        raise RuntimeError(msg)

    access_token = create_access_token({"sub": str(admin_user.id)})
    return {"Authorization": f"Bearer {access_token}"}


@pytest_asyncio.fixture
async def user_auth_headers(integration_session: AsyncSession) -> dict[str, str]:
    result = await integration_session.execute(
        select(User).where(User.username == "integration_user")
    )
    regular_user = result.scalar_one_or_none()
    if regular_user is None:
        msg = "Integration regular user not found"
        raise RuntimeError(msg)

    access_token = create_access_token({"sub": str(regular_user.id)})
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
