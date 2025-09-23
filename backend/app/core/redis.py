"""
Redis integration for token revocation and session management
"""

from __future__ import annotations

import logging

try:
    import redis.asyncio as redis

    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    redis = None

from urllib.parse import urlparse

from app.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper for session management"""

    def __init__(self):
        self._redis: redis.Redis | None = None
        self._connection_attempted = False

    async def connect(self) -> bool:
        """Connect to Redis server"""
        if not REDIS_AVAILABLE:
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

            self._redis = redis.Redis(
                host=host,
                port=port,
                db=db,
                decode_responses=True,
                socket_connect_timeout=5,
                health_check_interval=30,
            )

            # Test connection
            await self._redis.ping()
            logger.info("Connected to Redis successfully")
            return True

        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._redis = None
            return False

    async def disconnect(self):
        """Close Redis connection"""
        if self._redis:
            await self._redis.close()
            self._redis = None

    async def is_connected(self) -> bool:
        """Check if Redis is connected and available"""
        if not self._redis:
            return False

        try:
            await self._redis.ping()
            return True
        except Exception:
            return False

    async def set(self, key: str, value: str, ex: int | None = None) -> bool:
        """Set a key-value pair with optional expiration"""
        if not await self.is_connected() or not self._redis:
            return False

        try:
            await self._redis.set(key, value, ex=ex)
            return True
        except Exception as e:
            logger.exception(f"Redis SET failed: {e}")
            return False

    async def setex(self, key: str, time: int, value: str) -> bool:
        """Set key with expiration time"""
        return await self.set(key, value, ex=time)

    async def get(self, key: str) -> str | None:
        """Get value by key"""
        if not await self.is_connected() or not self._redis:
            return None

        try:
            value = await self._redis.get(key)
            # Ensure string return for tests even if backend returns bytes
            if isinstance(value, bytes):
                try:
                    return value.decode()
                except Exception:
                    return None
            return value
        except Exception as e:
            logger.exception(f"Redis GET failed: {e}")
            return None

    async def delete(self, *keys: str) -> int:
        """Delete one or more keys"""
        if not await self.is_connected() or not self._redis:
            return 0

        try:
            return await self._redis.delete(*keys)
        except Exception as e:
            logger.exception(f"Redis DELETE failed: {e}")
            return 0

    async def keys(self, pattern: str) -> list[str]:
        """Find keys matching pattern"""
        if not await self.is_connected() or not self._redis:
            return []

        try:
            return await self._redis.keys(pattern)
        except Exception as e:
            logger.exception(f"Redis KEYS failed: {e}")
            return []

    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not await self.is_connected() or not self._redis:
            return False

        try:
            return bool(await self._redis.exists(key))
        except Exception as e:
            logger.exception(f"Redis EXISTS failed: {e}")
            return False

    async def ttl(self, key: str) -> int:
        """Get time to live for key"""
        if not await self.is_connected() or not self._redis:
            return -1

        try:
            return await self._redis.ttl(key)
        except Exception as e:
            logger.exception(f"Redis TTL failed: {e}")
            return -1


# Global Redis client instance
redis_client = RedisClient()


async def init_redis():
    """Initialize Redis connection"""
    await redis_client.connect()


async def close_redis():
    """Close Redis connection"""
    await redis_client.disconnect()


# Token management helpers
class TokenManager:
    """Helper class for token-related Redis operations"""

    @staticmethod
    def refresh_token_key(user_id: str, jti: str) -> str:
        """Generate Redis key for refresh token"""
        return f"refresh_token:{user_id}:{jti}"

    @staticmethod
    async def store_refresh_token(user_id: str, jti: str, expires_in: int) -> bool:
        """Store refresh token in Redis"""
        key = TokenManager.refresh_token_key(user_id, jti)
        return await redis_client.setex(key, expires_in, "valid")

    @staticmethod
    async def is_refresh_token_valid(user_id: str, jti: str) -> bool:
        """Check if refresh token is valid"""
        key = TokenManager.refresh_token_key(user_id, jti)
        value = await redis_client.get(key)
        return value == "valid"

    @staticmethod
    async def revoke_refresh_token(user_id: str, jti: str) -> bool:
        """Revoke a specific refresh token"""
        key = TokenManager.refresh_token_key(user_id, jti)
        deleted = await redis_client.delete(key)
        return deleted > 0

    @staticmethod
    async def revoke_all_user_tokens(user_id: str) -> int:
        """Revoke all refresh tokens for a user"""
        pattern = f"refresh_token:{user_id}:*"
        keys = await redis_client.keys(pattern)
        if keys:
            return await redis_client.delete(*keys)
        return 0

    @staticmethod
    async def get_user_token_count(user_id: str) -> int:
        """Get number of active tokens for a user"""
        pattern = f"refresh_token:{user_id}:*"
        keys = await redis_client.keys(pattern)
        return len(keys)


# Session management helpers
class SessionManager:
    """Helper class for session-related Redis operations"""

    @staticmethod
    def session_key(session_id: str) -> str:
        """Generate Redis key for session"""
        return f"session:{session_id}"

    @staticmethod
    async def store_session(session_id: str, user_id: str, expires_in: int) -> bool:
        """Store session in Redis"""
        key = SessionManager.session_key(session_id)
        return await redis_client.setex(key, expires_in, user_id)

    @staticmethod
    async def get_session_user(session_id: str) -> str | None:
        """Get user ID from session"""
        key = SessionManager.session_key(session_id)
        return await redis_client.get(key)

    @staticmethod
    async def revoke_session(session_id: str) -> bool:
        """Revoke a session"""
        key = SessionManager.session_key(session_id)
        deleted = await redis_client.delete(key)
        return deleted > 0

    @staticmethod
    async def extend_session(session_id: str, expires_in: int) -> bool:
        """Extend session expiration"""
        key = SessionManager.session_key(session_id)
        if await redis_client.exists(key):
            user_id = await redis_client.get(key)
            if user_id:
                return await redis_client.setex(key, expires_in, user_id)
        return False
