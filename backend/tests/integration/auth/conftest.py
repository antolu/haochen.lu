from __future__ import annotations

import asyncio
import typing

import pytest

from app.core.oidc import oidc_validator
from app.models.user import User


@pytest.fixture(autouse=True)
def patch_oidc_validator(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Replace oidc_validator.validate_token with a test-friendly version that
    accepts tokens of the form "test-token-{oidc_id}" and returns a minimal
    payload. This avoids needing a real Authelia JWKS endpoint in integration
    tests for the user-session layer.

    Tokens issued by create_access_token (HS256, 'sub' = user UUID) are used
    only for the app OAuth broker layer (/authorize, /oauth/token, /jump/*) and
    are validated via decode_token, not oidc_validator. Those paths remain
    unchanged.
    """

    async def fake_validate(token: str) -> dict[str, typing.Any] | None:
        await asyncio.sleep(0)
        prefix = "test-token-"
        if token.startswith(prefix):
            oidc_id = token[len(prefix) :]
            return {
                "sub": oidc_id,
                "jti": f"jti-{oidc_id}",
                "iss": "http://auth.localhost",
            }
        return None

    monkeypatch.setattr(oidc_validator, "validate_token", fake_validate)


@pytest.fixture
def admin_token(admin_user: User) -> str:
    """Token for use with OIDC-validated endpoints."""
    return f"test-token-{admin_user.oidc_id}"
