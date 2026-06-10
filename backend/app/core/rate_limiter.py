from __future__ import annotations

import time
import typing
import uuid
from collections.abc import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.redis import redis_client
from app.core.runtime_settings import get_image_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis backend."""

    def __init__(
        self,
        app: typing.Any,
        calls: int = 100,  # Number of calls allowed
        period: int = 3600,  # Time period in seconds (1 hour)
        file_calls: int = 20,  # Calls for file endpoints
        file_period: int = 60,  # Period for file endpoints (1 minute)
        auth_calls: int = 60,  # Calls for auth endpoints
        auth_period: int = 60,  # Period for auth endpoints (1 minute)
    ):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.file_calls = file_calls
        self.file_period = file_period
        self.auth_calls = auth_calls
        self.auth_period = auth_period

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only apply rate limiting to relevant endpoints
        if not self._should_rate_limit(request):
            return typing.cast(Response, await call_next(request))

        # Get client identifier
        client_id = self._get_client_id(request)

        path = request.url.path
        is_auth_endpoint = path.startswith("/api/auth/")
        is_file_endpoint = "/file" in path or "/download" in path

        settings = get_image_settings()
        if is_auth_endpoint:
            calls_allowed = settings.rate_limit_auth_calls
            period = settings.rate_limit_auth_period
            key_suffix = "auth"
        elif is_file_endpoint:
            calls_allowed = settings.rate_limit_file_calls
            period = settings.rate_limit_file_period
            key_suffix = "file"
        else:
            calls_allowed = settings.rate_limit_calls
            period = settings.rate_limit_period
            key_suffix = "api"

        # Check rate limit
        if await self._is_rate_limited(client_id, calls_allowed, period, key_suffix):
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": f"Rate limit exceeded. Max {calls_allowed} requests per {period} seconds."
                },
                headers={"Retry-After": str(period)},
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        remaining = await self._get_remaining_calls(
            client_id, calls_allowed, period, key_suffix
        )
        response.headers["X-RateLimit-Limit"] = str(calls_allowed)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + period)

        return typing.cast(Response, response)

    def _should_rate_limit(self, request: Request) -> bool:
        """Determine if request should be rate limited."""
        if not get_image_settings().rate_limit_enabled:
            return False

        path = request.url.path

        # Auth endpoints — brute force protection
        if path.startswith("/api/auth/"):
            return True

        # Photo-related endpoints
        if path.startswith("/api/photos/"):
            return True

        # Public file downloads
        if path.startswith("/files/"):
            return True

        # File serving endpoints
        return bool("/file" in path or "/download" in path)

    def _get_client_id(self, request: Request) -> str:
        """Get unique identifier for client."""
        # Prefer user ID if authenticated
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"

        # Fall back to IP address
        client_ip = request.client.host if request.client else "unknown"

        # Check for forwarded IP
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()

        return f"ip:{client_ip}"  # nosemgrep: python.flask.security.audit.directly-returned-format-string.directly-returned-format-string

    async def _is_rate_limited(
        self, client_id: str, calls_allowed: int, period: int, key_suffix: str
    ) -> bool:
        """Check if client has exceeded rate limit."""
        if not redis_client or not redis_client._redis:  # noqa: SLF001
            # No Redis available, skip rate limiting
            return False

        key = f"rate_limit:{key_suffix}:{client_id}"
        current_time = int(time.time())
        window_start = current_time - period

        try:
            return await self._check_rate_limit_redis(
                key, current_time, window_start, period, calls_allowed
            )
        except Exception as e:
            print(f"Rate limiting error: {e}")
            return False

    async def _check_rate_limit_redis(
        self,
        key: str,
        current_time: int,
        window_start: int,
        period: int,
        calls_allowed: int,
    ) -> bool:
        if redis_client is None or redis_client._redis is None:  # noqa: SLF001
            msg = "Redis client not initialized"
            raise RuntimeError(msg)
        pipe = redis_client._redis.pipeline()  # noqa: SLF001
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        unique_id = f"{current_time}_{uuid.uuid4().hex[:8]}"
        pipe.zadd(key, {unique_id: current_time})
        pipe.expire(key, period + 10)
        results = await pipe.execute()
        return bool(results[1] >= calls_allowed)

    async def _get_remaining_calls(
        self, client_id: str, calls_allowed: int, period: int, key_suffix: str
    ) -> int:
        """Get remaining calls for client."""
        if not redis_client or not redis_client._redis:  # noqa: SLF001
            return calls_allowed

        key = f"rate_limit:{key_suffix}:{client_id}"
        current_time = int(time.time())
        window_start = current_time - period

        try:
            # Use the underlying Redis connection
            redis_conn = redis_client._redis  # noqa: SLF001

            # Count current requests in window
            await redis_conn.zremrangebyscore(key, 0, window_start)
            current_calls = await redis_conn.zcard(key)
            return int(max(0, calls_allowed - current_calls))
        except Exception:
            return calls_allowed


class FileAccessRateLimiter:
    """Specific rate limiter for file access operations."""

    @staticmethod
    async def check_download_limit(
        client_id: str, limit: int | None = None, period: int | None = None
    ) -> bool:
        """Check if client can download files (stricter limit for downloads)."""
        settings = get_image_settings()
        if not settings.rate_limit_enabled:
            return True

        if not redis_client or not redis_client._redis:  # noqa: SLF001
            return True

        if limit is None:
            limit = settings.rate_limit_file_calls
        if period is None:
            period = settings.rate_limit_file_period

        key = f"download_limit:{client_id}"
        current_time = int(time.time())
        window_start = current_time - period

        try:
            current_downloads = await FileAccessRateLimiter._record_download(
                key, current_time, window_start, period
            )
            return bool(current_downloads < limit)
        except Exception:
            return True

    @staticmethod
    async def _record_download(
        key: str, current_time: int, window_start: int, period: int
    ) -> int:
        if redis_client is None or redis_client._redis is None:  # noqa: SLF001
            msg = "Redis client not initialized"
            raise RuntimeError(msg)
        pipe = redis_client._redis.pipeline()  # noqa: SLF001
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(current_time): current_time})
        pipe.expire(key, period + 10)
        results = await pipe.execute()
        return int(results[1])
