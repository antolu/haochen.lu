"""
Unit Tests for Redis Integration
Tests Redis client functionality, token management, session handling,
and graceful fallback when Redis is unavailable.
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fakeredis import aioredis

from app.core.redis import (
    RedisClient,
    SessionManager,
    TokenManager,
    close_redis,
    init_redis,
)


@pytest.fixture
def fake_redis():
    """Create a fake Redis instance for testing."""
    return aioredis.FakeRedis(decode_responses=True)


@pytest.fixture
def redis_test_client():
    """Create a RedisClient instance with fake Redis."""
    client = RedisClient()
    client._redis = aioredis.FakeRedis(decode_responses=True)
    client._connection_attempted = True
    return client


@pytest.fixture
def redis_unavailable_client():
    """Create a RedisClient instance that simulates Redis being unavailable."""
    client = RedisClient()
    client._redis = None
    client._connection_attempted = True
    return client


async def test_connect_success():
    """Test successful Redis connection."""
    with patch("app.core.redis.redis_module.Redis") as mock_redis_class:
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True
        mock_redis_class.return_value = mock_redis

        client = RedisClient()
        result = await client.connect()

        assert result is True
        assert client._redis is not None
        mock_redis.ping.assert_called_once()


async def test_connect_failure():
    """Test Redis connection failure."""
    with patch("app.core.redis.redis_module.Redis") as mock_redis_class:
        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = Exception("Connection failed")
        mock_redis_class.return_value = mock_redis

        client = RedisClient()
        result = await client.connect()

        assert result is False
        assert client._redis is None


async def test_connect_redis_not_available():
    """Test when Redis module is not available."""
    with patch("app.core.redis.REDIS_AVAILABLE", new=False):
        client = RedisClient()
        result = await client.connect()

        assert result is False
        assert client._redis is None


async def test_connect_only_once():
    """Test that connection is only attempted once."""
    with patch("app.core.redis.redis_module.Redis") as mock_redis_class:
        mock_redis = AsyncMock()
        mock_redis.ping.return_value = True
        mock_redis_class.return_value = mock_redis

        client = RedisClient()

        # Connect twice
        result1 = await client.connect()
        result2 = await client.connect()

        assert result1 is True
        assert result2 is True
        # Redis constructor should only be called once
        mock_redis_class.assert_called_once()


async def test_disconnect(redis_test_client):
    """Test disconnecting from Redis."""
    assert redis_test_client._redis is not None

    await redis_test_client.disconnect()

    # Should close the connection
    assert redis_test_client._redis is None


async def test_is_connected_true(redis_test_client):
    """Test is_connected when Redis is available."""
    result = await redis_test_client.is_connected()
    assert result is True


async def test_is_connected_false_no_redis(redis_unavailable_client):
    """Test is_connected when Redis is not available."""
    result = await redis_unavailable_client.is_connected()
    assert result is False


async def test_is_connected_false_ping_fails(redis_test_client):
    """Test is_connected when ping fails."""
    redis_test_client._redis.ping = AsyncMock(side_effect=Exception("Ping failed"))

    result = await redis_test_client.is_connected()
    assert result is False


async def test_set_success(redis_test_client):
    """Test successful set operation."""
    result = await redis_test_client.set("test_key", "test_value")
    assert result is True

    # Verify value was set
    value = await redis_test_client._redis.get("test_key")
    assert value == "test_value"


async def test_set_with_expiry(redis_test_client):
    """Test set operation with expiry."""
    result = await redis_test_client.set("test_key", "test_value", ex=30)
    assert result is True

    # Verify TTL is set
    ttl = await redis_test_client._redis.ttl("test_key")
    assert 25 <= ttl <= 30


async def test_set_failure_no_connection(redis_unavailable_client):
    """Test set operation when Redis is unavailable."""
    result = await redis_unavailable_client.set("test_key", "test_value")
    assert result is False


async def test_setex_success(redis_test_client):
    """Test setex operation."""
    result = await redis_test_client.setex("test_key", 60, "test_value")
    assert result is True

    value = await redis_test_client._redis.get("test_key")
    assert value == "test_value"

    ttl = await redis_test_client._redis.ttl("test_key")
    assert 55 <= ttl <= 60


async def test_get_success(redis_test_client):
    """Test successful get operation."""
    await redis_test_client._redis.set("test_key", "test_value")

    result = await redis_test_client.get("test_key")
    assert result == "test_value"


async def test_get_nonexistent_key(redis_test_client):
    """Test get operation for nonexistent key."""
    result = await redis_test_client.get("nonexistent_key")
    assert result is None


async def test_get_failure_no_connection(redis_unavailable_client):
    """Test get operation when Redis is unavailable."""
    result = await redis_unavailable_client.get("test_key")
    assert result is None


async def test_delete_success(redis_test_client):
    """Test successful delete operation."""
    await redis_test_client._redis.set("test_key1", "value1")
    await redis_test_client._redis.set("test_key2", "value2")

    result = await redis_test_client.delete("test_key1", "test_key2")
    assert result == 2

    # Verify keys are deleted
    assert await redis_test_client._redis.get("test_key1") is None
    assert await redis_test_client._redis.get("test_key2") is None


async def test_delete_nonexistent_keys(redis_test_client):
    """Test delete operation for nonexistent keys."""
    result = await redis_test_client.delete("nonexistent1", "nonexistent2")
    assert result == 0


async def test_delete_failure_no_connection(redis_unavailable_client):
    """Test delete operation when Redis is unavailable."""
    result = await redis_unavailable_client.delete("test_key")
    assert result == 0


async def test_keys_success(redis_test_client):
    """Test keys pattern matching."""
    await redis_test_client._redis.set("user:1:token", "token1")
    await redis_test_client._redis.set("user:2:token", "token2")
    await redis_test_client._redis.set("session:123", "session")

    result = await redis_test_client.keys("user:*:token")
    assert len(result) == 2
    assert "user:1:token" in result
    assert "user:2:token" in result


async def test_keys_no_matches(redis_test_client):
    """Test keys pattern with no matches."""
    result = await redis_test_client.keys("nonexistent:*")
    assert result == []


async def test_keys_failure_no_connection(redis_unavailable_client):
    """Test keys operation when Redis is unavailable."""
    result = await redis_unavailable_client.keys("test:*")
    assert result == []


async def test_exists_true(redis_test_client):
    """Test exists operation for existing key."""
    await redis_test_client._redis.set("test_key", "value")

    result = await redis_test_client.exists("test_key")
    assert result is True


async def test_exists_false(redis_test_client):
    """Test exists operation for nonexistent key."""
    result = await redis_test_client.exists("nonexistent_key")
    assert result is False


async def test_exists_failure_no_connection(redis_unavailable_client):
    """Test exists operation when Redis is unavailable."""
    result = await redis_unavailable_client.exists("test_key")
    assert result is False


async def test_ttl_success(redis_test_client):
    """Test TTL operation."""
    await redis_test_client._redis.setex("test_key", 60, "value")

    result = await redis_test_client.ttl("test_key")
    assert 55 <= result <= 60


async def test_ttl_no_expiry(redis_test_client):
    """Test TTL for key without expiry."""
    await redis_test_client._redis.set("test_key", "value")

    result = await redis_test_client.ttl("test_key")
    assert result == -1


async def test_ttl_nonexistent_key(redis_test_client):
    """Test TTL for nonexistent key."""
    result = await redis_test_client.ttl("nonexistent_key")
    assert result == -2


async def test_ttl_failure_no_connection(redis_unavailable_client):
    """Test TTL operation when Redis is unavailable."""
    result = await redis_unavailable_client.ttl("test_key")
    assert result == -1


def test_refresh_token_key_generation():
    """Test refresh token key generation."""
    key = TokenManager.refresh_token_key("user123", "jti456")
    assert key == "refresh_token:user123:jti456"


async def test_store_refresh_token_success(redis_test_client):
    """Test storing refresh token."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.store_refresh_token("user123", "jti456", 3600)
        assert result is True

        # Verify token was stored
        stored_value = await redis_test_client.get("refresh_token:user123:jti456")
        assert stored_value == "valid"


async def test_store_refresh_token_failure(redis_unavailable_client):
    """Test storing refresh token when Redis is unavailable."""
    with patch("app.core.redis.redis_client", redis_unavailable_client):
        result = await TokenManager.store_refresh_token("user123", "jti456", 3600)
        assert result is False


async def test_is_refresh_token_valid_true(redis_test_client):
    """Test checking valid refresh token."""
    await redis_test_client.set("refresh_token:user123:jti456", "valid")

    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.is_refresh_token_valid("user123", "jti456")
        assert result is True


async def test_is_refresh_token_valid_false(redis_test_client):
    """Test checking invalid refresh token."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.is_refresh_token_valid("user123", "jti456")
        assert result is False


async def test_is_refresh_token_valid_unavailable(redis_unavailable_client):
    """Test checking refresh token when Redis is unavailable."""
    with patch("app.core.redis.redis_client", redis_unavailable_client):
        result = await TokenManager.is_refresh_token_valid("user123", "jti456")
        assert result is False


async def test_revoke_refresh_token_success(redis_test_client):
    """Test revoking refresh token."""
    await redis_test_client.set("refresh_token:user123:jti456", "valid")

    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.revoke_refresh_token("user123", "jti456")
        assert result is True

        # Verify token was removed
        stored_value = await redis_test_client.get("refresh_token:user123:jti456")
        assert stored_value is None


async def test_revoke_refresh_token_nonexistent(redis_test_client):
    """Test revoking nonexistent refresh token."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.revoke_refresh_token("user123", "jti456")
        assert result is False


async def test_revoke_all_user_tokens_success(redis_test_client):
    """Test revoking all tokens for a user."""
    await redis_test_client.set("refresh_token:user123:jti1", "valid")
    await redis_test_client.set("refresh_token:user123:jti2", "valid")
    await redis_test_client.set("refresh_token:user456:jti3", "valid")

    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.revoke_all_user_tokens("user123")
        assert result == 2

        # Verify only user123 tokens were removed
        assert await redis_test_client.get("refresh_token:user123:jti1") is None
        assert await redis_test_client.get("refresh_token:user123:jti2") is None
        assert await redis_test_client.get("refresh_token:user456:jti3") == "valid"


async def test_revoke_all_user_tokens_no_tokens(redis_test_client):
    """Test revoking all tokens when user has no tokens."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.revoke_all_user_tokens("user123")
        assert result == 0


async def test_get_user_token_count(redis_test_client):
    """Test getting count of user tokens."""
    await redis_test_client.set("refresh_token:user123:jti1", "valid")
    await redis_test_client.set("refresh_token:user123:jti2", "valid")
    await redis_test_client.set("refresh_token:user456:jti3", "valid")

    with patch("app.core.redis.redis_client", redis_test_client):
        count = await TokenManager.get_user_token_count("user123")
        assert count == 2

        count_other = await TokenManager.get_user_token_count("user456")
        assert count_other == 1

        count_none = await TokenManager.get_user_token_count("user789")
        assert count_none == 0


def test_session_key_generation():
    """Test session key generation."""
    key = SessionManager.session_key("session123")
    assert key == "session:session123"


async def test_store_session_success(redis_test_client):
    """Test storing session."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await SessionManager.store_session("session123", "user456", 1800)
        assert result is True

        # Verify session was stored
        stored_value = await redis_test_client.get("session:session123")
        assert stored_value == "user456"


async def test_store_session_failure(redis_unavailable_client):
    """Test storing session when Redis is unavailable."""
    with patch("app.core.redis.redis_client", redis_unavailable_client):
        result = await SessionManager.store_session("session123", "user456", 1800)
        assert result is False


async def test_get_session_user_success(redis_test_client):
    """Test getting user from session."""
    await redis_test_client.set("session:session123", "user456")

    with patch("app.core.redis.redis_client", redis_test_client):
        user_id = await SessionManager.get_session_user("session123")
        assert user_id == "user456"


async def test_get_session_user_nonexistent(redis_test_client):
    """Test getting user from nonexistent session."""
    with patch("app.core.redis.redis_client", redis_test_client):
        user_id = await SessionManager.get_session_user("session123")
        assert user_id is None


async def test_get_session_user_unavailable(redis_unavailable_client):
    """Test getting user when Redis is unavailable."""
    with patch("app.core.redis.redis_client", redis_unavailable_client):
        user_id = await SessionManager.get_session_user("session123")
        assert user_id is None


async def test_revoke_session_success(redis_test_client):
    """Test revoking session."""
    await redis_test_client.set("session:session123", "user456")

    with patch("app.core.redis.redis_client", redis_test_client):
        result = await SessionManager.revoke_session("session123")
        assert result is True

        # Verify session was removed
        stored_value = await redis_test_client.get("session:session123")
        assert stored_value is None


async def test_revoke_session_nonexistent(redis_test_client):
    """Test revoking nonexistent session."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await SessionManager.revoke_session("session123")
        assert result is False


async def test_extend_session_success(redis_test_client):
    """Test extending session expiry."""
    await redis_test_client.setex("session:session123", 300, "user456")

    with patch("app.core.redis.redis_client", redis_test_client):
        result = await SessionManager.extend_session("session123", 1800)
        assert result is True

        # Verify TTL was updated
        ttl = await redis_test_client.ttl("session:session123")
        assert 1795 <= ttl <= 1800


async def test_extend_session_nonexistent(redis_test_client):
    """Test extending nonexistent session."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await SessionManager.extend_session("session123", 1800)
        assert result is False


async def test_init_redis():
    """Test Redis initialization."""
    with patch("app.core.redis.redis_client.connect") as mock_connect:
        mock_connect.return_value = True

        await init_redis()

        mock_connect.assert_called_once()


async def test_close_redis():
    """Test Redis cleanup."""
    with patch("app.core.redis.redis_client.disconnect") as mock_disconnect:
        await close_redis()

        mock_disconnect.assert_called_once()


async def test_redis_operation_exception_handling(redis_test_client):
    """Test that Redis operation exceptions are handled gracefully."""
    # Mock Redis operation to raise exception
    redis_test_client._redis.set = AsyncMock(side_effect=Exception("Redis error"))

    # Operation should not raise exception but return False
    result = await redis_test_client.set("test_key", "test_value")
    assert result is False


async def test_connection_lost_during_operation(redis_test_client):
    """Test handling connection loss during operation."""
    # Simulate connection being lost
    redis_test_client._redis.ping = AsyncMock(side_effect=Exception("Connection lost"))

    result = await redis_test_client.is_connected()
    assert result is False


async def test_redis_timeout_handling(redis_test_client):
    """Test handling of Redis operation timeouts."""
    redis_test_client._redis.get = AsyncMock(
        side_effect=TimeoutError("Operation timed out")
    )

    result = await redis_test_client.get("test_key")
    assert result is None


async def test_concurrent_token_operations(redis_test_client):
    """Test concurrent token storage and retrieval."""
    with patch("app.core.redis.redis_client", redis_test_client):
        # Store multiple tokens concurrently
        tasks = []
        for i in range(10):
            task = TokenManager.store_refresh_token(f"user{i}", f"jti{i}", 3600)
            tasks.append(task)

        results = await asyncio.gather(*tasks)
        assert all(results)

        # Verify all tokens are valid concurrently
        tasks = []
        for i in range(10):
            task = TokenManager.is_refresh_token_valid(f"user{i}", f"jti{i}")
            tasks.append(task)

        results = await asyncio.gather(*tasks)
        assert all(results)


async def test_concurrent_user_token_revocation(redis_test_client):
    """Test concurrent revocation of user tokens."""
    # Store tokens for multiple users
    for user_id in ["user1", "user2", "user3"]:
        for jti_suffix in ["a", "b", "c"]:
            await redis_test_client.set(
                f"refresh_token:{user_id}:jti{jti_suffix}", "valid"
            )

    with patch("app.core.redis.redis_client", redis_test_client):
        # Revoke tokens for all users concurrently
        tasks = [
            TokenManager.revoke_all_user_tokens("user1"),
            TokenManager.revoke_all_user_tokens("user2"),
            TokenManager.revoke_all_user_tokens("user3"),
        ]

        results = await asyncio.gather(*tasks)
        assert results == [3, 3, 3]  # Each user had 3 tokens

        # Verify all tokens are gone
        for user_id in ["user1", "user2", "user3"]:
            count = await TokenManager.get_user_token_count(user_id)
            assert count == 0


async def test_very_long_keys(redis_test_client):
    """Test handling of very long Redis keys."""
    long_key = "a" * 1000  # Very long key
    result = await redis_test_client.set(long_key, "value")
    assert result is True

    retrieved_value = await redis_test_client.get(long_key)
    assert retrieved_value == "value"


async def test_very_long_values(redis_test_client):
    """Test handling of very long Redis values."""
    long_value = "x" * 10000  # Very long value
    result = await redis_test_client.set("test_key", long_value)
    assert result is True

    retrieved_value = await redis_test_client.get("test_key")
    assert retrieved_value == long_value


async def test_special_characters_in_keys_and_values(redis_test_client):
    """Test handling of special characters."""
    special_key = "key:with:colons/and/slashes@symbols#hash"
    special_value = "value with\nnewlines\tand\ttabs 🚀 émojis"

    result = await redis_test_client.set(special_key, special_value)
    assert result is True

    retrieved_value = await redis_test_client.get(special_key)
    assert retrieved_value == special_value


async def test_zero_expiry_time(redis_test_client):
    """Test handling of zero expiry time."""
    result = await redis_test_client.setex("test_key", 0, "value")
    # Behavior depends on Redis version, but should not crash
    assert isinstance(result, bool)


async def test_negative_expiry_time(redis_test_client):
    """Test handling of negative expiry time."""
    with patch("app.core.redis.redis_client", redis_test_client):
        result = await TokenManager.store_refresh_token("user", "jti", -100)
        # Should handle gracefully
        assert isinstance(result, bool)


async def test_empty_string_operations(redis_test_client):
    """Test operations with empty strings."""
    result = await redis_test_client.set("", "empty_key")
    assert result is True

    result = await redis_test_client.set("empty_value", "")
    assert result is True

    retrieved = await redis_test_client.get("empty_value")
    assert not retrieved
