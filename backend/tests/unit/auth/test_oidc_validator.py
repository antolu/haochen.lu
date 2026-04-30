from __future__ import annotations

import time

import jwt as pyjwt
import pytest
import respx
from arcadia_auth import OidcSettings, OidcValidator
from arcadia_auth.exceptions import JwksError, TokenExpiredError, TokenInvalidError
from authlib.jose import JsonWebKey
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from httpx import Response


@pytest.fixture(scope="module")
def rsa_private_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def jwks_data(rsa_private_key: rsa.RSAPrivateKey) -> dict:
    pub_bytes = rsa_private_key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    key = JsonWebKey.import_key(pub_bytes, {"kty": "RSA", "kid": "test-key-1"})
    return {"keys": [dict(key)]}


@pytest.fixture(scope="module")
def oidc_settings() -> OidcSettings:
    return OidcSettings(
        oidc_endpoint="http://keycloak:8080",
        oidc_public_endpoint="http://localhost:9091",
        oidc_realm="arcadia",
        oidc_client_id="myapp",
        oidc_client_secret="secret",
        oidc_redirect_uri="http://localhost/callback",
        oidc_init_retries=1,
        oidc_init_backoff=0.0,
    )


def _make_token(
    private_key: rsa.RSAPrivateKey,
    *,
    sub: str = "user-1",
    iss: str = "http://localhost:9091/realms/arcadia",
    exp_offset: int = 3600,
) -> str:
    priv_bytes = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    )
    now = int(time.time())
    return pyjwt.encode(
        {"sub": sub, "iss": iss, "exp": now + exp_offset, "iat": now, "jti": "tid-1"},
        priv_bytes,
        algorithm="RS256",
        headers={"kid": "test-key-1"},
    )


def _mock_discovery_and_jwks(settings: OidcSettings, jwks: dict) -> None:
    discovery_url = f"{settings.oidc_base_url}/.well-known/openid-configuration"
    jwks_url = f"{settings.oidc_base_url}/protocol/openid-connect/certs"
    respx.get(discovery_url).mock(
        return_value=Response(200, json={"jwks_uri": jwks_url})
    )
    respx.get(jwks_url).mock(return_value=Response(200, json=jwks))


@pytest.mark.unit
@pytest.mark.asyncio
async def test_validates_valid_token(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    token = _make_token(rsa_private_key)
    validator = OidcValidator(oidc_settings)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        result = await validator.validate_token(token)
    assert result["sub"] == "user-1"


@pytest.mark.unit
@pytest.mark.asyncio
async def test_raises_token_expired(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    token = _make_token(rsa_private_key, exp_offset=-1)
    validator = OidcValidator(oidc_settings)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        with pytest.raises(TokenExpiredError):
            await validator.validate_token(token)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_raises_token_invalid_wrong_issuer(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    token = _make_token(rsa_private_key, iss="http://evil.example.com")
    validator = OidcValidator(oidc_settings)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        with pytest.raises(TokenInvalidError):
            await validator.validate_token(token)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_raises_token_invalid_tampered(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    token = _make_token(rsa_private_key)[:-5] + "XXXXX"
    validator = OidcValidator(oidc_settings)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        with pytest.raises(TokenInvalidError):
            await validator.validate_token(token)


@pytest.mark.unit
@pytest.mark.asyncio
async def test_raises_token_invalid_garbage(
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    validator = OidcValidator(oidc_settings)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        with pytest.raises(TokenInvalidError):
            await validator.validate_token("not.a.valid.token")


@pytest.mark.unit
@pytest.mark.asyncio
async def test_raises_jwks_error_when_discovery_fails(
    oidc_settings: OidcSettings,
) -> None:
    validator = OidcValidator(oidc_settings)
    discovery_url = f"{oidc_settings.oidc_base_url}/.well-known/openid-configuration"
    with respx.mock:
        respx.get(discovery_url).mock(return_value=Response(503))
        with pytest.raises(JwksError):
            await validator.initialize()


@pytest.mark.unit
@pytest.mark.asyncio
async def test_jwks_cache_prevents_second_fetch(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    validator = OidcValidator(oidc_settings)
    token = _make_token(rsa_private_key)
    with respx.mock:
        _mock_discovery_and_jwks(oidc_settings, jwks_data)
        await validator.validate_token(token)
        call_count_after_first = respx.calls.call_count
        await validator.validate_token(token)
        assert respx.calls.call_count == call_count_after_first


@pytest.mark.unit
@pytest.mark.asyncio
async def test_jwks_cache_expires_and_refetches(
    rsa_private_key: rsa.RSAPrivateKey,
    jwks_data: dict,
    oidc_settings: OidcSettings,
) -> None:
    short_ttl_settings = OidcSettings(
        oidc_endpoint=oidc_settings.oidc_endpoint,
        oidc_public_endpoint=oidc_settings.oidc_public_endpoint,
        oidc_realm=oidc_settings.oidc_realm,
        oidc_client_id=oidc_settings.oidc_client_id,
        oidc_client_secret=oidc_settings.oidc_client_secret,
        oidc_redirect_uri=oidc_settings.oidc_redirect_uri,
        oidc_jwks_cache_ttl=0,
    )
    validator = OidcValidator(short_ttl_settings)
    token = _make_token(rsa_private_key)
    with respx.mock:
        _mock_discovery_and_jwks(short_ttl_settings, jwks_data)
        await validator.validate_token(token)
        call_count_after_first = respx.calls.call_count
        await validator.validate_token(token)
        assert respx.calls.call_count > call_count_after_first
