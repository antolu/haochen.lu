from __future__ import annotations

import inspect
import uuid

import fakeredis
import pytest

import app.api.auth as auth_mod
import app.core.security as sec_mod
from app.core import redis as redis_mod
from app.core.redis import TokenManager
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


@pytest.mark.unit
def test_access_token_has_jti_claim() -> None:
    token = create_access_token({"sub": "user-1"})
    payload = decode_token(token, expected_type="access")
    assert payload is not None
    assert "jti" in payload
    assert isinstance(payload["jti"], str)


@pytest.mark.unit
def test_jti_is_unique_per_token() -> None:
    token_a = create_access_token({"sub": "user-1"})
    token_b = create_access_token({"sub": "user-1"})
    payload_a = decode_token(token_a, expected_type="access")
    payload_b = decode_token(token_b, expected_type="access")
    assert payload_a is not None
    assert payload_b is not None
    assert payload_a["jti"] != payload_b["jti"]


@pytest.mark.unit
def test_password_hash_uses_bcrypt_directly() -> None:
    source = inspect.getsource(sec_mod)
    assert "hashlib" not in source


@pytest.mark.unit
def test_verify_password_bcrypt_direct() -> None:
    password = "correct-horse-battery-staple"
    hashed = get_password_hash(password)
    assert verify_password(password, hashed) is True
    assert verify_password("wrong-password", hashed) is False


@pytest.mark.unit
def test_timing_safe_client_secret_comparison() -> None:
    source = inspect.getsource(auth_mod)
    assert "hmac.compare_digest" in source


@pytest.mark.unit
def test_refresh_token_has_jti_claim() -> None:
    token = create_refresh_token({"sub": "user-1"})
    payload = decode_token(token, expected_type="refresh")
    assert payload is not None
    assert "jti" in payload
    assert isinstance(payload["jti"], str)


@pytest.mark.unit
def test_decode_token_rejects_wrong_type() -> None:
    access_token = create_access_token({"sub": "user-1"})
    result = decode_token(access_token, expected_type="refresh")
    assert result is None


@pytest.mark.unit
@pytest.mark.asyncio
async def test_blocklist_check_on_revoked_jti() -> None:
    fake_redis = fakeredis.FakeAsyncRedis(decode_responses=True)
    jti = str(uuid.uuid4())

    original_redis = redis_mod.redis_client._redis
    original_attempted = redis_mod.redis_client._connection_attempted
    redis_mod.redis_client._redis = fake_redis
    redis_mod.redis_client._connection_attempted = True

    try:
        await TokenManager.blocklist_access_token(jti, expires_in=300)
        blocked = await TokenManager.is_access_token_blocked(jti)
        assert blocked is True

        not_blocked = await TokenManager.is_access_token_blocked("other-jti")
        assert not_blocked is False
    finally:
        redis_mod.redis_client._redis = original_redis
        redis_mod.redis_client._connection_attempted = original_attempted
