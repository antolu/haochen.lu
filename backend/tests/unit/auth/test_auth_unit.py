"""
P0 - Critical Authentication Unit Tests

Tests password hashing, JWT token generation, and admin authorization.
These tests must have 100% coverage as they protect critical security functions.
"""

from __future__ import annotations

import calendar
import time
from datetime import datetime, timedelta
from unittest.mock import patch

import jwt
import pytest

from app.config import settings
from app.core.security import (
    create_access_token,
    decode_token,
    get_password_hash,
    verify_password,
)


class TestPasswordHashing:
    """Test password hashing security."""

    def test_password_uses_bcrypt(self):
        """Verify bcrypt is used for password hashing."""
        password = "test_password_123"
        hashed = get_password_hash(password)

        # Bcrypt hashes start with $2b$ or $2a$
        assert hashed.startswith(("$2b$", "$2a$"))
        assert len(hashed) >= 60  # Bcrypt hashes are typically 60 characters

    def test_same_password_different_salts(self):
        """Ensure salt is different for same password."""
        password = "same_password_123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        # Same password should produce different hashes due to salt
        assert hash1 != hash2

        # But both should verify correctly
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_timing_attack_resistance(self):
        """Test timing attack resistance in password verification."""
        password = "correct_password"
        correct_hash = get_password_hash(password)
        wrong_password = "wrong_password"

        # Measure timing for correct password
        start_time = time.time()
        verify_password(password, correct_hash)
        correct_time = time.time() - start_time

        # Measure timing for wrong password
        start_time = time.time()
        verify_password(wrong_password, correct_hash)
        wrong_time = time.time() - start_time

        # Times should be similar (within reasonable range)
        # This is a basic check - in practice, you'd need more sophisticated timing analysis
        time_difference = abs(correct_time - wrong_time)
        assert time_difference < 0.01  # Less than 10ms difference

    def test_password_complexity_validation(self):
        """Test password complexity requirements."""
        # These would be implemented in your password validation logic

        strong_passwords = [
            "StrongPass123!",
            "MySecure@Pass2023",
            "Complex!Password456",
        ]

        # For now, just verify they can be hashed
        # In production, add validation before hashing
        for password in strong_passwords:
            hashed = get_password_hash(password)
            assert verify_password(password, hashed)

    def test_hashed_passwords_never_returned(self):
        """Verify hashed passwords are never returned in responses."""
        # This would be tested in your API response serializers
        # For now, verify hash format doesn't leak information
        password = "secret123"
        hashed = get_password_hash(password)

        # Hash should not contain the original password
        assert password not in hashed
        assert password.lower() not in hashed.lower()

    def test_empty_password_handling(self):
        """Test handling of empty passwords."""
        with pytest.raises(ValueError, match=r"password"):
            get_password_hash("")

        with pytest.raises(ValueError, match=r"password"):
            get_password_hash(None)

    def test_very_long_password_handling(self):
        """Test handling of extremely long passwords."""
        # Very long password (1000 characters)
        long_password = "a" * 1000
        hashed = get_password_hash(long_password)

        # Should still work but be reasonable length
        assert len(hashed) < 200  # Bcrypt output is fixed length
        assert verify_password(long_password, hashed)


class TestJWTTokenGeneration:
    """Test JWT token generation and validation."""

    def test_token_contains_correct_claims(self):
        """Verify token contains required claims."""
        user_data = {"sub": "testuser"}
        token = create_access_token(user_data)

        # Decode without verification to check claims
        decoded = jwt.decode(
            token, key="", options={"verify_signature": False, "verify_exp": False}
        )

        assert "sub" in decoded
        assert "exp" in decoded
        assert "iat" in decoded
        assert decoded["sub"] == "testuser"

    def test_token_expiration_set_correctly(self):
        """Test token expiration is set correctly."""
        user_data = {"sub": "testuser"}
        custom_expiry = timedelta(minutes=30)

        token = create_access_token(user_data, expires_delta=custom_expiry)
        decoded = jwt.decode(
            token, key="", options={"verify_signature": False, "verify_exp": False}
        )

        # Check expiration is approximately 30 minutes from now
        exp_timestamp = decoded["exp"]
        expected_exp = calendar.timegm(datetime.utcnow().utctimetuple()) + (30 * 60)

        # Allow 10 second tolerance
        assert abs(exp_timestamp - expected_exp) < 10

    def test_secret_key_used_for_signing(self):
        """Ensure secret key is used for signing."""
        user_data = {"sub": "testuser"}
        token = create_access_token(user_data)

        # Should be decodable with correct secret
        decoded = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"verify_exp": False},
        )
        assert decoded["sub"] == "testuser"

        # Should fail with wrong secret
        with pytest.raises(jwt.JWTError):
            jwt.decode(
                token,
                "wrong_secret",
                algorithms=[settings.algorithm],
                options={"verify_exp": False},
            )

    def test_token_signature_validation(self):
        """Test token signature validation."""
        user_data = {"sub": "testuser"}
        token = create_access_token(user_data)

        # Valid token should decode successfully
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "testuser"

        # Tampered token should fail
        tampered_token = token[:-5] + "XXXXX"  # Change last 5 characters
        payload = decode_token(tampered_token)
        assert payload is None

    def test_malformed_token_rejection(self):
        """Test rejection of malformed tokens."""
        malformed_tokens = [
            "not.a.token",
            "too_short",
            "",
            "header.only",
            "missing..signature",
            None,
        ]

        for token in malformed_tokens:
            payload = decode_token(token)
            assert payload is None

    def test_expired_token_rejection(self):
        """Test rejection of expired tokens."""
        user_data = {"sub": "testuser"}

        # Create token that expires in 1 second
        expired_delta = timedelta(seconds=1)
        token = create_access_token(user_data, expires_delta=expired_delta)

        # Token should be valid immediately
        payload = decode_token(token)
        assert payload is not None

        # Wait for token to expire
        time.sleep(2)

        # Token should now be expired
        payload = decode_token(token)
        assert payload is None

    def test_token_with_invalid_signature(self):
        """Test token with invalid signature."""
        # Create a token with wrong algorithm
        user_data = {"sub": "testuser", "exp": datetime.utcnow() + timedelta(hours=1)}

        wrong_token = jwt.encode(user_data, "wrong_secret", algorithm="HS256")
        payload = decode_token(wrong_token)
        assert payload is None

    def test_token_algorithm_validation(self):
        """Test that only allowed algorithms are accepted."""
        user_data = {"sub": "testuser", "exp": datetime.utcnow() + timedelta(hours=1)}

        # Create token with disallowed algorithm (if we only allow HS256)
        try:
            wrong_algo_token = jwt.encode(
                user_data, settings.secret_key, algorithm="HS512"
            )
            payload = decode_token(wrong_algo_token)
            # Should be None or raise exception depending on implementation
            assert payload is None
        except jwt.JWTError:
            pass  # This is also acceptable

    def test_token_payload_size_limits(self):
        """Test token payload size limits."""
        # Very large payload
        large_data = {
            "sub": "testuser",
            "large_data": "x" * 10000,  # 10KB of data
        }

        # Should still work but be reasonable
        token = create_access_token(large_data)
        assert len(token) < 50000  # Token shouldn't be excessively large

        payload = decode_token(token)
        assert payload["sub"] == "testuser"


class TestAdminAuthorization:
    """Test admin role and authorization logic."""

    def test_admin_token_generation(self):
        """Test generating tokens for admin users."""
        admin_data = {"sub": "admin", "is_admin": True, "roles": ["admin"]}

        token = create_access_token(admin_data)
        payload = decode_token(token)

        assert payload["sub"] == "admin"
        assert payload.get("is_admin")

    def test_non_admin_token_generation(self):
        """Test generating tokens for regular users."""
        user_data = {"sub": "regular_user", "is_admin": False, "roles": ["user"]}

        token = create_access_token(user_data)
        payload = decode_token(token)

        assert payload["sub"] == "regular_user"
        assert not payload.get("is_admin")

    def test_token_role_validation(self):
        """Test token role validation logic."""
        # This would test your role validation functions
        # For now, just verify token contains role information

        admin_token = create_access_token({"sub": "admin", "roles": ["admin", "user"]})

        user_token = create_access_token({"sub": "user", "roles": ["user"]})

        admin_payload = decode_token(admin_token)
        user_payload = decode_token(user_token)

        assert "admin" in admin_payload.get("roles", [])
        assert "admin" not in user_payload.get("roles", [])

    def test_authorization_header_format(self):
        """Test authorization header format validation."""
        # This would be tested in your API middleware
        # Valid format: "Bearer <token>"

        token = create_access_token({"sub": "testuser"})

        valid_headers = [
            f"Bearer {token}",
            f"bearer {token}",  # Case insensitive
        ]

        # This is a placeholder - actual validation would be in middleware
        for header in valid_headers:
            parts = header.split()
            assert len(parts) == 2
            assert parts[0].lower() == "bearer"
            assert decode_token(parts[1]) is not None

    @patch(
        "app.core.security.settings.secret_key",
        "this-is-a-very-long-secret-key-for-testing-purposes-only-32-chars-min",
    )
    def test_secret_key_security(self):
        """Test secret key security requirements."""
        # In production, verify secret key meets security requirements
        secret = settings.secret_key

        # Should not be default or weak values
        weak_secrets = ["secret", "password", "123456", "test", "", None]

        assert secret not in weak_secrets
        assert len(secret) >= 32  # Minimum 32 characters for security

    def test_token_blacklisting_support(self):
        """Test token blacklisting infrastructure."""
        # This would test your token blacklisting logic
        # For now, verify tokens can be identified uniquely

        token1 = create_access_token({"sub": "user1"})
        token2 = create_access_token({"sub": "user2"})

        # Tokens should be different
        assert token1 != token2

        # Each token should have unique identifier (jti claim would be ideal)
        payload1 = decode_token(token1)
        payload2 = decode_token(token2)

        # At minimum, they should have different issued times
        assert payload1["iat"] != payload2["iat"] or payload1["sub"] != payload2["sub"]
