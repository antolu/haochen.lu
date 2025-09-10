"""
Mock Redis service for testing.
"""

from __future__ import annotations

from typing import Any


class MockRedis:
    """Mock Redis client that stores data in memory."""

    def __init__(self):
        self.data: dict[str, Any] = {}
        self.expires: dict[str, float] = {}
        self._connected = True

    async def get(self, key: str) -> bytes | None:
        """Get a value from the mock Redis."""
        if key in self.data:
            value = self.data[key]
            if isinstance(value, str):
                return value.encode()
            return value
        return None

    async def set(self, key: str, value: Any, ex: int | None = None) -> bool:
        """Set a value in the mock Redis."""
        if isinstance(value, bytes):
            value = value.decode()
        self.data[key] = value
        if ex:
            import time

            self.expires[key] = time.time() + ex
        return True

    async def delete(self, *keys: str) -> int:
        """Delete keys from the mock Redis."""
        deleted_count = 0
        for key in keys:
            if key in self.data:
                del self.data[key]
                if key in self.expires:
                    del self.expires[key]
                deleted_count += 1
        return deleted_count

    async def exists(self, key: str) -> bool:
        """Check if a key exists in the mock Redis."""
        return key in self.data

    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration for a key."""
        if key in self.data:
            import time

            self.expires[key] = time.time() + seconds
            return True
        return False

    async def ttl(self, key: str) -> int:
        """Get time to live for a key."""
        if key in self.expires:
            import time

            remaining = self.expires[key] - time.time()
            return max(0, int(remaining))
        return -1

    async def flushdb(self) -> bool:
        """Clear all data from the mock Redis."""
        self.data.clear()
        self.expires.clear()
        return True

    async def ping(self) -> bool:
        """Ping the mock Redis."""
        return self._connected

    async def close(self) -> None:
        """Close the mock Redis connection."""
        self._connected = False

    # Session management methods
    async def sadd(self, key: str, *values: str) -> int:
        """Add values to a set."""
        if key not in self.data:
            self.data[key] = set()

        if not isinstance(self.data[key], set):
            self.data[key] = set()

        added = 0
        for value in values:
            if value not in self.data[key]:
                self.data[key].add(value)
                added += 1
        return added

    async def srem(self, key: str, *values: str) -> int:
        """Remove values from a set."""
        if key not in self.data or not isinstance(self.data[key], set):
            return 0

        removed = 0
        for value in values:
            if value in self.data[key]:
                self.data[key].remove(value)
                removed += 1

        if not self.data[key]:  # Remove empty set
            del self.data[key]

        return removed

    async def sismember(self, key: str, value: str) -> bool:
        """Check if value is in a set."""
        if key in self.data and isinstance(self.data[key], set):
            return value in self.data[key]
        return False

    # Hash operations
    async def hset(self, key: str, field: str, value: Any) -> int:
        """Set a hash field."""
        if key not in self.data:
            self.data[key] = {}

        if not isinstance(self.data[key], dict):
            self.data[key] = {}

        is_new = field not in self.data[key]
        self.data[key][field] = value
        return 1 if is_new else 0

    async def hget(self, key: str, field: str) -> str | None:
        """Get a hash field."""
        if key in self.data and isinstance(self.data[key], dict):
            return self.data[key].get(field)
        return None

    async def hdel(self, key: str, *fields: str) -> int:
        """Delete hash fields."""
        if key not in self.data or not isinstance(self.data[key], dict):
            return 0

        deleted = 0
        for field in fields:
            if field in self.data[key]:
                del self.data[key][field]
                deleted += 1

        if not self.data[key]:  # Remove empty hash
            del self.data[key]

        return deleted


class AsyncRedisMock(MockRedis):
    """Async version of MockRedis for easier testing."""

    pass


def create_redis_mock() -> MockRedis:
    """Create a mock Redis instance."""
    return MockRedis()


def create_fakeredis():
    """Create a FakeRedis instance (requires fakeredis package)."""
    try:
        import fakeredis.aioredis

        return fakeredis.aioredis.FakeRedis()
    except ImportError:
        # Fallback to our mock if fakeredis is not available
        return MockRedis()


# Fixtures for pytest
import pytest


@pytest.fixture
def mock_redis():
    """Pytest fixture for mock Redis."""
    return MockRedis()


@pytest.fixture
def redis_client():
    """Pytest fixture for Redis client."""
    return create_fakeredis()


# Mock for Redis connection pool
class MockRedisPool:
    """Mock Redis connection pool."""

    def __init__(self, redis_instance: MockRedis):
        self.redis = redis_instance

    async def acquire(self):
        """Acquire a connection from the pool."""
        return self.redis

    async def release(self, connection):
        """Release a connection back to the pool."""
        pass

    async def close(self):
        """Close the connection pool."""
        await self.redis.close()
