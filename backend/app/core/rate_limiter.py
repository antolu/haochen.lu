from __future__ import annotations

import time
import typing
import uuid
from collections.abc import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.redis import redis_client


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis backend."""

    def __init__(
        self,
        app: typing.Any,
        calls: int = 100,  # Number of calls allowed
        period: int = 3600,  # Time period in seconds (1 hour)
        file_calls: int = 20,  # Calls for file endpoints
        file_period: int = 60,  # Period for file endpoints (1 minute)
    ):
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.file_calls = file_calls
        self.file_period = file_period

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Only apply rate limiting to file access endpoints
        if not self._should_rate_limit(request):
            return typing.cast(Response, await call_next(request))

        # Get client identifier
        client_id = self._get_client_id(request)

        # Check if file endpoint (more restrictive)
        is_file_endpoint = (
            "/file" in request.url.path or "/download" in request.url.path
        )

        if is_file_endpoint:
            calls_allowed = self.file_calls
            period = self.file_period
            key_suffix = "file"
        else:
            calls_allowed = self.calls
            period = self.period
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
        path = request.url.path

        # Apply to photo-related endpoints
        if path.startswith("/api/photos/"):
            return True

        # Apply to file serving endpoints
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

        return f"ip:{client_ip}"

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
            # Use the underlying Redis connection for pipeline operations
            redis_conn = redis_client._redis  # noqa: SLF001

            # Use Redis sorted set to track requests in time window
            pipe = redis_conn.pipeline()

            # Remove old entries
            pipe.zremrangebyscore(key, 0, window_start)

            # Count current requests
            pipe.zcard(key)

            # Add current request - use unique identifier to avoid conflicts
            unique_id = f"{current_time}_{uuid.uuid4().hex[:8]}"
            pipe.zadd(key, {unique_id: current_time})

            # Set expiration
            pipe.expire(key, period + 10)  # Add buffer for cleanup

            results = await pipe.execute()
            current_calls = results[1]  # Result from zcard
        except Exception as e:
            # If Redis fails, allow the request
            print(f"Rate limiting error: {e}")
            return False
        else:
            return bool(current_calls >= calls_allowed)

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
        client_id: str, limit: int = 10, period: int = 300
    ) -> bool:
        """Check if client can download files (stricter limit for downloads)."""
        if not redis_client or not redis_client._redis:  # noqa: SLF001
            return True

        key = f"download_limit:{client_id}"
        current_time = int(time.time())
        window_start = current_time - period

        try:
            # Use the underlying Redis connection for pipeline operations
            redis_conn = redis_client._redis  # noqa: SLF001
            pipe = redis_conn.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            pipe.zadd(key, {str(current_time): current_time})
            pipe.expire(key, period + 10)

            results = await pipe.execute()
            current_downloads = results[1]
        except Exception:
            return True
        else:
            return bool(current_downloads < limit)
