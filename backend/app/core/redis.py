"""
Redis integration for token revocation and session management
"""

from __future__ import annotations

import logging
import typing

try:
    import redis.asyncio as redis_module

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis_module = typing.cast(typing.Any, None)

import inspect
from urllib.parse import urlparse

from app.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper for session management"""

    @staticmethod
    async def _await_if_necessary(
        value: object,
    ) -> typing.Any:
        """Await the value if it's awaitable, otherwise return it directly.

        Some redis async clients expose methods that may be synchronous in
        certain test/mocking scenarios. This helper normalizes the call so the
        implementation can `await` safely without mypy complaining about
        union types like `Awaitable[bool] | bool`.
        """
        if inspect.isawaitable(value):
            return await typing.cast(typing.Awaitable[typing.Any], value)  # type: ignore[redundant-cast]
        return value

    def __init__(self) -> None:
        self._redis: typing.Any | None = None
        self._connection_attempted = False

    async def connect(self) -> bool:
        """Connect to Redis server"""
        if not REDIS_AVAILABLE or redis_module is None:
            logger.warning(
                "Redis not available - install redis[asyncio] for session management"
            )
            return False

        if self._connection_attempted:
            return self._redis is not None

        self._connection_attempted = True

        try:
            # Parse URL and construct client using Redis() so tests can patch redis.Redis
            parsed = urlparse(settings.redis_url)
            host = parsed.hostname or "localhost"
            port = int(parsed.port or 6379)
            try:
                db_str = (parsed.path or "/0").lstrip("/")
                db = int(db_str) if db_str else 0
            except Exception:
                db = 0

            self._redis = redis_module.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True,
                socket_connect_timeout=5,
                health_check_interval=30,
            )

            # Test connection (some clients return a bool synchronously while
            # others provide an awaitable). Normalize with helper.
            await self._await_if_necessary(self._redis.ping())
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._redis = None
            return False
        else:
            return True

    async def disconnect(self) -> None:
        """Close Redis connection"""
        if self._redis:
            await self._await_if_necessary(self._redis.close())
            self._redis = None

    async def is_connected(self) -> bool:
        """Check if Redis is connected and available"""
        if not self._redis:
            return False

        try:
            await self._await_if_necessary(self._redis.ping())
        except Exception:
            return False
        else:
            return True

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        """Set a key-value pair with optional expiration"""
        if not await self.is_connected() or not self._redis:
            return False

        try:
            await self._await_if_necessary(self._redis.set(key, value, ex=ex))
        except Exception:
            logger.exception("Redis SET failed")
            return False
        else:
            return True

    async def setex(self, key: str, time: int, value: str) -> bool:
        """Set key with expiration time"""
        return await self.set(key, value, ex=time)

    async def get(self, key: str) -> str | None:
        """Get value by key"""
        if not await self.is_connected() or not self._redis:
            return None

        try:
            value = await self._await_if_necessary(self._redis.get(key))
            # Ensure string return for tests even if backend returns bytes
            if isinstance(value, bytes):
                try:
                    return value.decode()
                except Exception:
                    return None
        except Exception:
            logger.exception("Redis GET failed")
            return None
        else:
            return value or None

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys"""
        if not await self.is_connected() or not self._redis:
            return 0

        try:
            return int(await self._await_if_necessary(self._redis.delete(*keys)))
        except Exception:
            logger.exception("Redis DELETE failed")
            return 0

    async def keys(self, pattern: str) -> list[str]:
        """Find keys matching pattern"""
        if not await self.is_connected() or not self._redis:
            return []

        try:
            keys = await self._await_if_necessary(self._redis.keys(pattern))
            return [str(k) for k in keys]
        except Exception:
            logger.exception("Redis KEYS failed")
            return []

    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not await self.is_connected() or not self._redis:
            return False

        try:
            return bool(await self._await_if_necessary(self._redis.exists(key)))
        except Exception:
            logger.exception("Redis EXISTS failed")
            return False

    async def ttl(self, key: str) -> int:
        """Get time to live for key"""
        if not await self.is_connected() or not self._redis:
            return -1

        try:
            return int(await self._await_if_necessary(self._redis.ttl(key)))
        except Exception:
            logger.exception("Redis TTL failed")
            return -1


# Global Redis client instance
redis_client = RedisClient()


async def init_redis() -> None:
    """Initialize Redis connection"""
    await redis_client.connect()


async def close_redis() -> None:
    """Close Redis connection"""
    await redis_client.disconnect()


# Token management helpers
class TokenManager:
    """Redis operations for access token blocklisting.

    Refresh tokens are owned by Authelia — only access token revocation
    (on logout) is tracked here.
    """

    @staticmethod
    async def blocklist_access_token(jti: str, expires_in: int) -> bool:
        """Add an access token JTI to the blocklist until it naturally expires."""
        key = f"blocklist_access:{jti}"
        return await redis_client.setex(key, expires_in, "revoked")

    @staticmethod
    async def is_access_token_blocked(jti: str) -> bool:
        """Check if an access token has been blocklisted."""
        key = f"blocklist_access:{jti}"
        return await redis_client.exists(key)
