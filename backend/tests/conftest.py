"""
Test configuration and fixtures for the portfolio backend.
"""

from __future__ import annotations

import calendar
import io
import os
import socket
import tempfile
from collections.abc import AsyncGenerator, Generator
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import urlparse

import anyio
from PIL import Image

# Set required environment variables for testing before importing app modules
os.environ.setdefault("SECRET_KEY", "test_secret_key_for_testing_minimum_32_chars")
os.environ.setdefault(
    "SESSION_SECRET_KEY", "test_session_secret_key_for_testing_minimum_32_chars"
)
os.environ.setdefault("ADMIN_PASSWORD", "test_password")

import contextlib

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.core.file_access as fa_mod
import app.core.image_processor as ip_mod
from app import config as app_config
from app.config import Settings
from app.core.redis import redis_client
from app.database import Base, get_session
from app.main import app
from app.models import BlogPost, Photo, Project, User
from tests.factories import BlogPostFactory, PhotoFactory, ProjectFactory, UserFactory


# Test settings override
@pytest.fixture
def test_settings() -> Settings:
    """Override settings for testing."""
    return Settings(
        database_url="sqlite+aiosqlite:///:memory:",
        # Prefer docker redis service if available; override with REDIS_URL env
        redis_url=os.getenv("REDIS_URL", "redis://redis:6379/1"),
        secret_key="test-secret-key-for-testing-only",
        admin_password="test-admin-password",
        upload_dir="test_uploads",
        compressed_dir="test_compressed",
        cors_origins=["http://localhost:3000", "http://testserver"],
    )


# Database fixtures
@pytest_asyncio.fixture
async def test_engine():
    """Create an async in-memory SQLite engine for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def test_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def db_session(test_session: AsyncSession) -> AsyncSession:  # noqa: RUF029
    """Alias for test_session for backward compatibility."""
    return test_session


@pytest.fixture
def override_get_session(test_session):
    """Override the get_session dependency for testing."""

    def _override_get_session():
        yield test_session

    return _override_get_session


# HTTP client fixtures
@pytest.fixture
def test_client(test_settings, override_get_session) -> TestClient:
    """Create a test client with database override."""
    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    # Ensure Redis connection is closed between tests
    with contextlib.suppress(Exception):
        anyio.run(redis_client.disconnect)


@pytest_asyncio.fixture
async def async_client(
    test_settings, override_get_session
) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client compatible with httpx>=0.28."""
    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
    app.dependency_overrides.clear()
    await redis_client.disconnect()


# Service availability gates
def _is_service_available(url: str, timeout: float = 0.2) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or "localhost"
        port = int(parsed.port or 0)
        if not port:
            return False
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def pytest_collection_modifyitems(config, items):
    """Skip integration tests that depend on external services if unavailable."""
    redis_url = os.getenv("REDIS_URL", "redis://redis:6379/1")
    redis_up = _is_service_available(redis_url)

    for item in items:
        # Markers in our suite that depend on Redis/services
        if (
            item.get_closest_marker("redis")
            or "auth" in item.nodeid
            or "session" in item.nodeid
        ) and not redis_up:
            item.add_marker(pytest.mark.skip(reason="Redis service unavailable"))


# Authentication fixtures
@pytest_asyncio.fixture
async def admin_user(test_session: AsyncSession) -> User:
    """Create an admin user for testing."""
    return await UserFactory.create_async(
        test_session, username="admin", is_admin=True, is_active=True
    )


@pytest_asyncio.fixture
async def regular_user(test_session: AsyncSession) -> User:
    """Create a regular user for testing."""
    return await UserFactory.create_async(
        test_session, username="testuser", is_admin=False, is_active=True
    )


def create_access_token_for_user(user: User, settings: Settings) -> str:
    """Create JWT access token for a user - replacement for old security function."""
    to_encode = {"sub": user.email}  # fastapi-users uses email
    now = datetime.utcnow()
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({
        "exp": calendar.timegm(expire.utctimetuple()),
        "iat": calendar.timegm(now.utctimetuple()),
        "type": "access",
    })
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


@pytest.fixture
def admin_token(admin_user: User, test_settings: Settings) -> str:
    """Generate a JWT token for admin user."""
    return create_access_token_for_user(admin_user, test_settings)


@pytest.fixture
def admin_headers(admin_token: str) -> dict[str, str]:
    """Create headers with admin authorization."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest_asyncio.fixture
async def authenticated_client(  # noqa: RUF029
    async_client: AsyncClient, admin_headers: dict[str, str]
) -> AsyncClient:
    """Create an authenticated async client with admin headers pre-configured."""
    async_client.headers.update(admin_headers)
    return async_client


# File system fixtures
@pytest.fixture
def temp_upload_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for file uploads."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def temp_compressed_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for compressed images."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture(autouse=True)
def use_temp_storage_dirs(
    temp_upload_dir: Path, temp_compressed_dir: Path, monkeypatch
):
    """Route storage to temp dirs during tests for isolation.

    Ensures that any file writes go to per-test temporary directories
    instead of the development/production folders.
    """
    # Override settings
    monkeypatch.setattr(
        app_config.settings, "upload_dir", str(temp_upload_dir), raising=False
    )
    monkeypatch.setattr(
        app_config.settings, "compressed_dir", str(temp_compressed_dir), raising=False
    )

    # Reinitialize global image processor with temp dirs
    ip_mod.image_processor = ip_mod.ImageProcessor(
        str(temp_upload_dir), str(temp_compressed_dir)
    )

    # Reinitialize file access controller to pick up new settings
    fa_mod.file_access_controller = fa_mod.FileAccessController()


# Mock fixtures
@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    import fakeredis  # noqa: PLC0415

    return fakeredis.FakeRedis()


@pytest.fixture
def mock_image_processor():
    """Mock image processor."""
    mock = MagicMock()
    mock.process_image = AsyncMock(
        return_value={
            "filename": "test_image.jpg",
            "original_path": "uploads/test_image.jpg",
            "webp_path": "compressed/test_image.webp",
            "thumbnail_path": "compressed/test_image_thumb.webp",
            "file_size": 1024000,
            "width": 1920,
            "height": 1080,
            "camera_make": "Canon",
            "camera_model": "EOS R5",
            "iso": 100,
            "aperture": 2.8,
            "shutter_speed": "1/125",
            "focal_length": 85,
        }
    )
    return mock


@pytest.fixture
def mock_email_service():
    """Mock email service."""
    mock = MagicMock()
    mock.send_email = AsyncMock(return_value=True)
    mock.sent_emails = []
    return mock


# Test data fixtures
@pytest_asyncio.fixture
async def sample_photo(test_session: AsyncSession) -> Photo:
    """Create a sample photo for testing."""
    return await PhotoFactory.create_async(test_session)


@pytest_asyncio.fixture
async def sample_photos(test_session: AsyncSession) -> list[Photo]:
    """Create multiple sample photos for testing."""
    photos = []
    for i in range(5):
        photo = await PhotoFactory.create_async(
            test_session,
            title=f"Test Photo {i + 1}",
            featured=(i == 0),  # First photo is featured
        )
        photos.append(photo)
    return photos


@pytest_asyncio.fixture
async def sample_project(test_session: AsyncSession) -> Project:
    """Create a sample project for testing."""
    return await ProjectFactory.create_async(test_session)


@pytest_asyncio.fixture
async def sample_blog_post(test_session: AsyncSession) -> BlogPost:
    """Create a sample blog post for testing."""
    return await BlogPostFactory.create_async(test_session)


# Image test fixtures
@pytest.fixture
def sample_image_data() -> bytes:
    """Generate sample image data for testing."""

    # Create a small test image
    img = Image.new("RGB", (100, 100), color="red")
    img_bytes = io.BytesIO()
    img.save(img_bytes, format="JPEG")
    img_bytes.seek(0)
    return img_bytes.getvalue()


@pytest.fixture
def sample_image_with_exif() -> bytes:
    """Generate sample image with EXIF data."""

    # Create image with basic EXIF
    img = Image.new("RGB", (200, 200), color="blue")

    # Add some EXIF data

    img_bytes = io.BytesIO()
    img.save(img_bytes, format="JPEG")
    img_bytes.seek(0)
    return img_bytes.getvalue()


# Security test fixtures
@pytest.fixture
def malicious_svg_content() -> str:
    """SVG content with potential XSS."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert('XSS')">
    <circle cx="50" cy="50" r="40" fill="red"/>
</svg>"""


@pytest.fixture
def sql_injection_payloads() -> list[str]:
    """Common SQL injection payloads for testing."""
    return [
        "'; DROP TABLE photos; --",
        "1' OR '1'='1",
        "admin'--",
        "1; INSERT INTO users VALUES ('hacker', 'password'); --",
        "' UNION SELECT * FROM users --",
    ]


# Performance test fixtures
@pytest.fixture
def large_dataset_photos(test_session: AsyncSession):
    """Create a large dataset for performance testing."""

    async def _create_photos(count: int = 1000):
        photos = []
        for i in range(count):
            photo = await PhotoFactory.create_async(
                test_session,
                title=f"Performance Test Photo {i}",
                featured=(i % 50 == 0),  # Every 50th photo is featured
            )
            photos.append(photo)
        return photos

    return _create_photos


# Cleanup fixtures
@pytest.fixture(autouse=True)
def cleanup_files(temp_upload_dir, temp_compressed_dir):
    """Automatically clean up test files after each test."""
    return
    # Cleanup happens automatically with temp directories


# Custom markers
def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line("markers", "slow: marks tests as slow")
    config.addinivalue_line("markers", "integration: marks tests as integration tests")
    config.addinivalue_line("markers", "unit: marks tests as unit tests")
    config.addinivalue_line("markers", "security: marks tests as security tests")
    config.addinivalue_line("markers", "performance: marks tests as performance tests")


# Custom assertions
class CustomAssertions:
    """Custom assertion helpers for tests."""

    @staticmethod
    def assert_valid_jwt_token(token: str) -> None:
        """Assert that a JWT token is valid."""
        try:
            from app.config import settings  # noqa: PLC0415

            payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
            assert payload is not None
            assert "sub" in payload
            assert "exp" in payload
        except Exception:
            pytest.fail("Invalid JWT token")

    @staticmethod
    def assert_image_processed_correctly(metadata: dict) -> None:
        """Assert that image processing metadata is correct."""
        required_fields = [
            "filename",
            "original_path",
            "webp_path",
            "file_size",
            "width",
            "height",
        ]
        for field in required_fields:
            assert field in metadata
            assert metadata[field] is not None

    @staticmethod
    def assert_no_xss_vulnerability(content: str) -> None:
        """Assert that content doesn't contain XSS vulnerabilities."""
        dangerous_tags = ["<script", "<iframe", "<object", "<embed"]
        for tag in dangerous_tags:
            assert tag.lower() not in content.lower()

    @staticmethod
    def assert_sql_injection_safe(query_log: list) -> None:
        """Assert that no dangerous SQL was executed."""
        dangerous_patterns = ["DROP TABLE", "DELETE FROM", "INSERT INTO"]
        for query in query_log:
            for pattern in dangerous_patterns:
                assert pattern not in query.upper()


@pytest.fixture
def assert_helper():
    """Provide custom assertion helpers."""
    return CustomAssertions()
