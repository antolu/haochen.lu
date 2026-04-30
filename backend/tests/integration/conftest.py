from __future__ import annotations

import os
import time
from collections.abc import AsyncGenerator
from pathlib import Path

import jwt as pyjwt
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.user import User

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
IMAGES_DIR = FIXTURES_DIR / "images"

# Fixed private key for signing integration test tokens.
# The corresponding public key is served by mock-oidc in docker-compose.test.yml.
_INTEGRATION_PRIVATE_KEY_PEM = b"""-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAyJjF4HzwTd0al4Soi6iu9Dt8pfQc9o2QK23a6GlLpd1gjro1
QnY6s1D+nVhEwtubCC1G5bTQ8x8pwlydcTlfd8w8Dr2G4WjbCXV6dAMgpDZQuBS0
SoFJYWivMMqZE5cRcm3IMe1MQIyurVLLgzp3BiP9ff5Xnv2Q4dc9TumY5xRa96WU
2bHG7x5enKXvi3nqHdB2rZuS8zFJdEaB8JppcE/ra71HLmpJuYINQcI28KU5e3rM
Wvpi9bx/MGDjhsQjU8QSrQkjKJA/RbWBpO2fbz0mUcvWTKbOJuZH06Kk6sS8fmhi
1AMtrfuSyHB9fMVpJU7jNuF1v8LnW39W4jAm9QIDAQABAoIBABOuvdfBmpihRc8x
MpKFiiknvxrPgZoFmOxR+qVMU6JiPuuyRLCRRkA7BcitlQ2jm6opOygl3kzEtYW/
Lami7gWksg3mNdpfPgLHFq1Uczr5o2D0kx4uYmNe8LWyY2PDMnCOahLQDGfXBfq2
wYZOUch19pUKxFEy4yjtxDO+gwTFU2Bwucs1Vz7RJ6waMKgNPmu9CZLax6mcKY3C
xcHERy0vLkm198LldWTu97b6qj3Ieb4Zchhs2loeTJJO21+Hwa2nb3wriYRu01FV
arnytAjHKsrmSXV/vOiBEviEoD0vsuLkiADG/kF7lKxGPHjcryk/45fVdNBeVyXM
Cbd/wiECgYEA+I9dzdFdlr7a+bfxXcvvhqX3eGnp+B49ri3ihrTol0B0QGaL9IUj
P5SZutMW8USXrszdDTlV6waBY6L1JdsyPRHKIj1zNy7zljaUJmGOfXGM/8fNzMfK
azdVRu6EfiKzEmMlC/BPO7js6D7v/ewfH1CU4ERdYMA+HhvBhXdfhOUCgYEAzpnh
QbXldTGAWBWJw1KBEvPbukrs14HQlj31KzP4U8pyc1mUjRaWeC8f1N9vuiOdS63p
elgqKQgbNkfgChcsBEIhi34iqd8Le3M5UeSqb0NylMVi16pGU0fdx1NeVdhBHY17
ZXzQOqHCwvyEeDI7tyH5+RXdkdSJkA5ZdK1/iNECgYB6AKTiaWmunG+PMyJeD8O6
K6yUhig5iV5tKEiQJiwkUZa+JZd8pfzvMFlkwkf4lNp/Cj9WRlZNzhukdFAwDK9U
Gm9E7zSmWX1mtdNyI2B1Yk77HW9+nHJWvgo1js2pvA55cAC3I3VAszxVos7ZrBR6
omrwyZ2r57CVxrnucPGJoQKBgCyWiUblOuBQDqL0AwdkhvbQKlvKT9My8RF7za3F
SZLL3meGrcjFVzQY94W5syM5DHmIzxrYbEDuvvC4EmIbHiTNIPA6CMEgohnChFxo
PWBF7jStZOemmAbhO7wJAhME2QjHwBnnFgmRX7c1SGGodbrQWmKnlWojtIyijCvi
ReQBAoGBAJO/fd8Gi6irc2OkTG1AKEDbt42a0+FYuFksiLjOFz2MMUWqg0JorpSk
TbCoLxU36sk2QVYn4RjOmhTqf1L0lZbQiYkMxP3RDrC+hcf9eC1RQThQUxXyJnP4
u7ffjAQlfBS+YWAszg+DY8aZ+f71JfnAkcl+WZaf8+rlKUShHyGC
-----END RSA PRIVATE KEY-----"""


def _sign_integration_token(sub: str) -> str:
    now = int(time.time())
    return pyjwt.encode(
        {
            "sub": sub,
            "iss": "http://mock-oidc:8080/realms/arcadia",
            "exp": now + 3600,
            "iat": now,
            "jti": f"integration-{sub}",
        },
        _INTEGRATION_PRIVATE_KEY_PEM,
        algorithm="RS256",
        headers={"kid": "integration-key-1"},
    )


@pytest.fixture
def fixture_images() -> dict[str, Path]:
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
    return fixture_images["landscape"]


@pytest.fixture
def sample_exif_image_path(fixture_images: dict[str, Path]) -> Path:
    return fixture_images["with_exif"]


@pytest_asyncio.fixture
async def integration_engine():
    engine = create_async_engine(settings.database_url, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
def integration_session_maker(integration_engine):
    return async_sessionmaker(
        integration_engine, class_=AsyncSession, expire_on_commit=False
    )


@pytest_asyncio.fixture
async def integration_session(
    integration_session_maker,
) -> AsyncGenerator[AsyncSession, None]:
    async with integration_session_maker() as session:
        yield session


@pytest_asyncio.fixture
async def integration_client() -> AsyncGenerator[AsyncClient, None]:
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
    token = _sign_integration_token(str(admin_user.oidc_id))
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def user_auth_headers(integration_session: AsyncSession) -> dict[str, str]:
    result = await integration_session.execute(
        select(User).where(User.username == "integration_user")
    )
    regular_user = result.scalar_one_or_none()
    if regular_user is None:
        msg = "Integration regular user not found"
        raise RuntimeError(msg)
    token = _sign_integration_token(str(regular_user.oidc_id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def authenticated_admin_client(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
) -> AsyncClient:
    integration_client.headers.update(admin_auth_headers)
    return integration_client


@pytest.fixture
def authenticated_user_client(
    integration_client: AsyncClient,
    user_auth_headers: dict[str, str],
) -> AsyncClient:
    integration_client.headers.update(user_auth_headers)
    return integration_client


def pytest_configure(config) -> None:
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests (requires full stack)"
    )
    config.addinivalue_line(
        "markers", "requires_fixtures: marks tests that require fixture images"
    )
