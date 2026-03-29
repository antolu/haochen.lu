from __future__ import annotations

import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat

from app.core.oidc import OidcValidator


def _generate_rsa_keypair() -> tuple[rsa.RSAPrivateKey, rsa.RSAPublicKey]:
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    return private_key, private_key.public_key()


def _make_jwk(public_key: rsa.RSAPublicKey) -> dict:
    pub_bytes = public_key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    return json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(pub_bytes))  # type: ignore[attr-defined]


def _make_token(
    private_key: rsa.RSAPrivateKey,
    *,
    sub: str = "user-1",
    iss: str = "http://auth.localhost",
    exp_offset: int = 3600,
    extra: dict | None = None,
) -> str:
    priv_bytes = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    now = int(time.time())
    payload = {
        "sub": sub,
        "iss": iss,
        "exp": now + exp_offset,
        "iat": now,
        "jti": "test-jti-1",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, priv_bytes, algorithm="RS256")


def _make_validator_with_keys(keys: list) -> OidcValidator:
    validator = OidcValidator.__new__(OidcValidator)
    validator._jwks_keys = keys
    validator._jwks_fetched_at = time.monotonic()
    validator._cache_ttl = 3600
    return validator


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validates_valid_rs256_token() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key)
    validator = _make_validator_with_keys([public_key])

    result = await validator.validate_token(token)

    assert result is not None
    assert result["sub"] == "user-1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rejects_expired_token() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key, exp_offset=-1)
    validator = _make_validator_with_keys([public_key])

    result = await validator.validate_token(token)

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rejects_wrong_issuer() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key, iss="http://evil.example.com")
    validator = _make_validator_with_keys([public_key])

    result = await validator.validate_token(token)

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_rejects_tampered_token() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key)
    tampered = token[:-5] + "XXXXX"
    validator = _make_validator_with_keys([public_key])

    result = await validator.validate_token(tampered)

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_jwks_cache_is_used_on_second_call() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key)

    jwk = _make_jwk(public_key)
    jwk["kty"] = "RSA"

    discovery_data = {"jwks_uri": "http://auth.localhost/jwks"}
    jwks_data = {"keys": [jwk]}

    call_count = 0

    def fake_get_sync(url: str, **_kwargs):
        nonlocal call_count
        call_count += 1
        mock = MagicMock()
        mock.status_code = 200
        if "openid-configuration" in url:
            mock.json.return_value = discovery_data
        else:
            mock.json.return_value = jwks_data
        return mock

    validator = OidcValidator.__new__(OidcValidator)
    validator._jwks_keys = []
    validator._jwks_fetched_at = 0.0
    validator._cache_ttl = 3600

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=fake_get_sync)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await validator.validate_token(token)
        initial_calls = call_count
        await validator.validate_token(token)

    assert call_count == initial_calls


@pytest.mark.unit
@pytest.mark.asyncio
async def test_jwks_cache_expires_and_refreshes() -> None:
    private_key, public_key = _generate_rsa_keypair()
    token = _make_token(private_key)

    jwk = _make_jwk(public_key)
    jwk["kty"] = "RSA"

    discovery_data = {"jwks_uri": "http://auth.localhost/jwks"}
    jwks_data = {"keys": [jwk]}

    refresh_count = 0

    def fake_get_sync(url: str, **_kwargs):
        nonlocal refresh_count
        mock = MagicMock()
        mock.status_code = 200
        if "openid-configuration" in url:
            refresh_count += 1
            mock.json.return_value = discovery_data
        else:
            mock.json.return_value = jwks_data
        return mock

    validator = OidcValidator.__new__(OidcValidator)
    validator._jwks_keys = []
    validator._jwks_fetched_at = 0.0
    validator._cache_ttl = 0  # expire immediately

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=fake_get_sync)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await validator.validate_token(token)
        first_refresh = refresh_count
        await validator.validate_token(token)

    assert refresh_count > first_refresh


@pytest.mark.unit
@pytest.mark.asyncio
async def test_returns_none_on_invalid_token() -> None:
    _private_key, public_key = _generate_rsa_keypair()
    validator = _make_validator_with_keys([public_key])

    result = await validator.validate_token("not.a.valid.token")

    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_returns_none_when_jwks_unavailable() -> None:
    validator = OidcValidator.__new__(OidcValidator)
    validator._jwks_keys = []
    validator._jwks_fetched_at = 0.0
    validator._cache_ttl = 3600

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        mock_resp.text = "unavailable"
        mock_client.get = AsyncMock(return_value=mock_resp)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        result = await validator.validate_token("any.token.here")

    assert result is None
