"""
Unit Tests for Token Manager
Tests token creation, verification, cookie management, and security features
of the enhanced token management system.
"""

from __future__ import annotations

from unittest.mock import Mock, patch

import jwt
import pytest
from app.core.security import TokenManager
from fastapi import HTTPException, Response
from freezegun import freeze_time


@pytest.fixture
def mock_response():
    """Mock FastAPI Response object."""
    return Mock(spec=Response)


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    with patch("app.core.security.settings") as mock:
        mock.access_token_expire_minutes = 15
        mock.refresh_token_expire_days = 30
        mock.refresh_token_expire_minutes = 60
        mock.secret_key = "test-secret-key"
        mock.session_secret_key = "test-session-secret"
        mock.algorithm = "HS256"
        mock.refresh_cookie_name = "refresh_token"
        mock.cookie_secure = True
        mock.cookie_httponly = True
        mock.cookie_samesite = "lax"
        mock.cookie_domain = None
        yield mock


class TestTokenCreation:
    """Test token creation functionality."""

    def test_create_access_token_basic(self, mock_settings):
        """Test basic access token creation."""
        data = {"sub": "testuser", "user_id": "123"}

        token = TokenManager.create_access_token(data)

        assert token is not None
        assert isinstance(token, str)

        # Decode and verify
        payload = jwt.decode(token, mock_settings.secret_key, algorithms=["HS256"])
        assert payload["sub"] == "testuser"
        assert payload["user_id"] == "123"
        assert payload["type"] == "access"
        assert "exp" in payload

    def test_create_access_token_expiry(self, mock_settings):
        """Test access token expiry time."""
        data = {"sub": "testuser"}

        with freeze_time("2024-01-01 12:00:00") as frozen_time:
            token = TokenManager.create_access_token(data)

            payload = jwt.decode(token, mock_settings.secret_key, algorithms=["HS256"])
            expected_exp = frozen_time().timestamp() + (15 * 60)  # 15 minutes

            assert abs(payload["exp"] - expected_exp) < 1  # Allow 1 second tolerance

    def test_create_refresh_token_with_remember_me(self, mock_settings):
        """Test refresh token creation with remember me flag."""
        data = {"sub": "testuser", "user_id": "123"}

        token = TokenManager.create_refresh_token(data, remember_me=True)

        assert token is not None
        payload = jwt.decode(
            token, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert payload["sub"] == "testuser"
        assert payload["type"] == "refresh"
        assert payload["remember_me"] is True
        assert "jti" in payload  # JWT ID for revocation
        assert len(payload["jti"]) > 0

    def test_create_refresh_token_without_remember_me(self, mock_settings):
        """Test refresh token creation without remember me flag."""
        data = {"sub": "testuser"}

        token = TokenManager.create_refresh_token(data, remember_me=False)

        payload = jwt.decode(
            token, mock_settings.session_secret_key, algorithms=["HS256"]
        )
        assert payload["remember_me"] is False

    def test_create_refresh_token_expiry_with_remember_me(self, mock_settings):
        """Test refresh token expiry with remember me."""
        data = {"sub": "testuser"}

        with freeze_time("2024-01-01 12:00:00") as frozen_time:
            token = TokenManager.create_refresh_token(data, remember_me=True)

            payload = jwt.decode(
                token, mock_settings.session_secret_key, algorithms=["HS256"]
            )
            expected_exp = frozen_time().timestamp() + (30 * 24 * 60 * 60)  # 30 days

            assert abs(payload["exp"] - expected_exp) < 1

    def test_create_refresh_token_expiry_without_remember_me(self, mock_settings):
        """Test refresh token expiry without remember me."""
        data = {"sub": "testuser"}

        with freeze_time("2024-01-01 12:00:00") as frozen_time:
            token = TokenManager.create_refresh_token(data, remember_me=False)

            payload = jwt.decode(
                token, mock_settings.session_secret_key, algorithms=["HS256"]
            )
            expected_exp = frozen_time().timestamp() + (60 * 60)  # 60 minutes

            assert abs(payload["exp"] - expected_exp) < 1

    def test_refresh_token_jti_uniqueness(self, mock_settings):
        """Test that refresh tokens have unique JTI values."""
        data = {"sub": "testuser"}

        token1 = TokenManager.create_refresh_token(data)
        token2 = TokenManager.create_refresh_token(data)

        payload1 = jwt.decode(
            token1, mock_settings.session_secret_key, algorithms=["HS256"]
        )
        payload2 = jwt.decode(
            token2, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert payload1["jti"] != payload2["jti"]


class TestTokenVerification:
    """Test token verification functionality."""

    def test_verify_refresh_token_valid(self, mock_settings):
        """Test verification of valid refresh token."""
        data = {"sub": "testuser", "user_id": "123"}
        token = TokenManager.create_refresh_token(data)

        payload = TokenManager.verify_refresh_token(token)

        assert payload["sub"] == "testuser"
        assert payload["user_id"] == "123"
        assert payload["type"] == "refresh"

    def test_verify_refresh_token_invalid_signature(self, mock_settings):
        """Test verification of token with invalid signature."""
        data = {"sub": "testuser"}
        token = TokenManager.create_refresh_token(data)

        # Tamper with token
        tampered_token = token[:-5] + "XXXXX"

        with pytest.raises(HTTPException) as exc_info:
            TokenManager.verify_refresh_token(tampered_token)

        assert exc_info.value.status_code == 401
        assert "Invalid refresh token" in str(exc_info.value.detail)

    def test_verify_refresh_token_wrong_type(self, mock_settings):
        """Test verification of access token as refresh token."""
        data = {"sub": "testuser"}
        access_token = TokenManager.create_access_token(data)

        with pytest.raises(HTTPException) as exc_info:
            TokenManager.verify_refresh_token(access_token)

        assert exc_info.value.status_code == 401
        assert "Invalid token type" in str(exc_info.value.detail)

    def test_verify_refresh_token_expired(self, mock_settings):
        """Test verification of expired refresh token."""
        data = {"sub": "testuser"}

        with freeze_time("2024-01-01 12:00:00"):
            token = TokenManager.create_refresh_token(data, remember_me=False)

        # Move time forward past expiry (60 minutes + buffer)
        with freeze_time("2024-01-01 13:30:00"):
            with pytest.raises(HTTPException) as exc_info:
                TokenManager.verify_refresh_token(token)

            assert exc_info.value.status_code == 401

    def test_verify_refresh_token_malformed(self, mock_settings):
        """Test verification of malformed token."""
        with pytest.raises(HTTPException) as exc_info:
            TokenManager.verify_refresh_token("not.a.valid.jwt.token")

        assert exc_info.value.status_code == 401


class TestCookieManagement:
    """Test cookie setting and management."""

    def test_set_refresh_cookie_with_remember_me(self, mock_response, mock_settings):
        """Test setting refresh cookie with remember me."""
        token = "test-refresh-token"

        TokenManager.set_refresh_cookie(mock_response, token, remember_me=True)

        mock_response.set_cookie.assert_called_once()
        call_args = mock_response.set_cookie.call_args

        # Check positional arguments
        assert call_args[1]["key"] == mock_settings.refresh_cookie_name
        assert call_args[1]["value"] == token

        # Check cookie security settings
        assert call_args[1]["secure"] == mock_settings.cookie_secure
        assert call_args[1]["httponly"] == mock_settings.cookie_httponly
        assert call_args[1]["samesite"] == mock_settings.cookie_samesite
        assert call_args[1]["domain"] == mock_settings.cookie_domain

        # Check max_age for remember me (30 days in seconds)
        expected_max_age = 30 * 24 * 60 * 60
        assert call_args[1]["max_age"] == expected_max_age

    def test_set_refresh_cookie_without_remember_me(self, mock_response, mock_settings):
        """Test setting refresh cookie without remember me (session cookie)."""
        token = "test-refresh-token"

        TokenManager.set_refresh_cookie(mock_response, token, remember_me=False)

        call_args = mock_response.set_cookie.call_args

        # Should be session cookie (no max_age)
        assert call_args[1]["max_age"] is None

    def test_unset_refresh_cookie(self, mock_response, mock_settings):
        """Test removing refresh cookie."""
        TokenManager.unset_refresh_cookie(mock_response)

        mock_response.delete_cookie.assert_called_once()
        call_args = mock_response.delete_cookie.call_args

        assert call_args[1]["key"] == mock_settings.refresh_cookie_name
        assert call_args[1]["secure"] == mock_settings.cookie_secure
        assert call_args[1]["httponly"] == mock_settings.cookie_httponly
        assert call_args[1]["samesite"] == mock_settings.cookie_samesite
        assert call_args[1]["domain"] == mock_settings.cookie_domain


class TestTokenSecurity:
    """Test security aspects of token management."""

    def test_access_and_refresh_tokens_use_different_secrets(self, mock_settings):
        """Test that access and refresh tokens use different secrets."""
        data = {"sub": "testuser"}

        access_token = TokenManager.create_access_token(data)
        refresh_token = TokenManager.create_refresh_token(data)

        # Access token should decode with SECRET_KEY
        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        assert access_payload["sub"] == "testuser"

        # Refresh token should decode with SESSION_SECRET_KEY
        refresh_payload = jwt.decode(
            refresh_token, mock_settings.session_secret_key, algorithms=["HS256"]
        )
        assert refresh_payload["sub"] == "testuser"

        # They should not be interchangeable
        with pytest.raises((jwt.JWTError, ValueError)):
            jwt.decode(
                access_token, mock_settings.session_secret_key, algorithms=["HS256"]
            )

        with pytest.raises((jwt.JWTError, ValueError)):
            jwt.decode(refresh_token, mock_settings.SECRET_KEY, algorithms=["HS256"])

    def test_jti_is_secure_random(self, mock_settings):
        """Test that JTI values are securely generated."""
        data = {"sub": "testuser"}

        # Generate multiple tokens and check JTI uniqueness and length
        jtis = []
        for _ in range(10):
            token = TokenManager.create_refresh_token(data)
            payload = jwt.decode(
                token, mock_settings.session_secret_key, algorithms=["HS256"]
            )
            jtis.append(payload["jti"])

        # All JTIs should be unique
        assert len(set(jtis)) == 10

        # JTIs should be of reasonable length (base64url encoded)
        for jti in jtis:
            assert len(jti) >= 32  # At least 32 characters
            assert all(c.isalnum() or c in ["-", "_"] for c in jti)  # Base64url safe

    def test_token_type_enforcement(self, mock_settings):
        """Test that token types are properly enforced."""
        data = {"sub": "testuser"}

        access_token = TokenManager.create_access_token(data)
        refresh_token = TokenManager.create_refresh_token(data)

        # Verify token types are set correctly
        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        refresh_payload = jwt.decode(
            refresh_token, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert access_payload["type"] == "access"
        assert refresh_payload["type"] == "refresh"

    def test_token_expiry_enforcement(self, mock_settings):
        """Test that token expiry times are within expected ranges."""
        data = {"sub": "testuser"}

        with freeze_time("2024-01-01 12:00:00") as frozen_time:
            current_time = frozen_time().timestamp()

            # Test access token expiry
            access_token = TokenManager.create_access_token(data)
            access_payload = jwt.decode(
                access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
            )
            access_expiry = access_payload["exp"] - current_time

            # Should be exactly 15 minutes (900 seconds)
            assert 899 <= access_expiry <= 901

            # Test refresh token expiry with remember me
            refresh_token_long = TokenManager.create_refresh_token(
                data, remember_me=True
            )
            refresh_payload_long = jwt.decode(
                refresh_token_long,
                mock_settings.session_secret_key,
                algorithms=["HS256"],
            )
            refresh_expiry_long = refresh_payload_long["exp"] - current_time

            # Should be exactly 30 days
            expected_long = 30 * 24 * 60 * 60
            assert expected_long - 1 <= refresh_expiry_long <= expected_long + 1

            # Test refresh token expiry without remember me
            refresh_token_short = TokenManager.create_refresh_token(
                data, remember_me=False
            )
            refresh_payload_short = jwt.decode(
                refresh_token_short,
                mock_settings.session_secret_key,
                algorithms=["HS256"],
            )
            refresh_expiry_short = refresh_payload_short["exp"] - current_time

            # Should be exactly 60 minutes
            expected_short = 60 * 60
            assert expected_short - 1 <= refresh_expiry_short <= expected_short + 1


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_data_handling(self, mock_settings):
        """Test handling of empty token data."""
        empty_data = {}

        # Should not fail with empty data
        access_token = TokenManager.create_access_token(empty_data)
        refresh_token = TokenManager.create_refresh_token(empty_data)

        assert access_token is not None
        assert refresh_token is not None

        # Tokens should still be valid
        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        refresh_payload = jwt.decode(
            refresh_token, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert access_payload["type"] == "access"
        assert refresh_payload["type"] == "refresh"

    def test_large_data_handling(self, mock_settings):
        """Test handling of large token payloads."""
        large_data = {
            "sub": "testuser",
            "user_id": "123",
            "roles": ["admin", "user", "moderator"] * 100,  # Large array
            "permissions": {f"perm_{i}": True for i in range(100)},  # Large dict
            "metadata": "x" * 1000,  # Large string
        }

        # Should handle large payloads
        access_token = TokenManager.create_access_token(large_data)
        refresh_token = TokenManager.create_refresh_token(large_data)

        assert access_token is not None
        assert refresh_token is not None

        # Should be decodable
        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        refresh_payload = jwt.decode(
            refresh_token, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert access_payload["sub"] == "testuser"
        assert refresh_payload["sub"] == "testuser"

    def test_special_characters_in_data(self, mock_settings):
        """Test handling of special characters in token data."""
        special_data = {
            "sub": "test@user.com",
            "name": "Test User with Símböls & Ëmöjis 🚀",
            "description": "A user with\nnewlines\tand\ttabs",
            "unicode": "こんにちは世界",
        }

        access_token = TokenManager.create_access_token(special_data)
        refresh_token = TokenManager.create_refresh_token(special_data)

        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        refresh_payload = jwt.decode(
            refresh_token, mock_settings.session_secret_key, algorithms=["HS256"]
        )

        assert access_payload["sub"] == "test@user.com"
        assert access_payload["name"] == "Test User with Símböls & Ëmöjis 🚀"
        assert refresh_payload["unicode"] == "こんにちは世界"

    def test_none_values_in_data(self, mock_settings):
        """Test handling of None values in token data."""
        data_with_none = {
            "sub": "testuser",
            "optional_field": None,
            "empty_string": "",
            "zero_value": 0,
            "false_value": False,
        }

        access_token = TokenManager.create_access_token(data_with_none)

        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )

        assert access_payload["sub"] == "testuser"
        assert access_payload["optional_field"] is None
        assert not access_payload["empty_string"]
        assert access_payload["zero_value"] == 0
        assert access_payload["false_value"] is False

    def test_cookie_settings_edge_cases(self, mock_response, mock_settings):
        """Test cookie settings with edge case configurations."""
        # Test with None domain
        mock_settings.cookie_domain = None
        TokenManager.set_refresh_cookie(mock_response, "token")

        call_args = mock_response.set_cookie.call_args
        assert call_args[1]["domain"] is None

        # Test with empty string domain
        mock_settings.cookie_domain = ""
        TokenManager.set_refresh_cookie(mock_response, "token")

        call_args = mock_response.set_cookie.call_args
        assert not call_args[1]["domain"]

    @patch("app.core.security.uuid.uuid4")
    def test_jti_generation_uses_uuid(self, mock_uuid4, mock_settings):
        """Test JTI generation uses uuid.uuid4."""
        from uuid import UUID  # noqa: PLC0415

        mock_uuid4.return_value = UUID("12345678-1234-5678-1234-567812345678")

        data = {"sub": "testuser"}
        token = TokenManager.create_refresh_token(data)

        payload = jwt.decode(
            token, mock_settings.session_secret_key, algorithms=["HS256"]
        )
        assert payload["jti"] == "12345678-1234-5678-1234-567812345678"

        mock_uuid4.assert_called_once()


class TestIntegration:
    """Test integration between different token management features."""

    def test_complete_token_lifecycle(self, mock_response, mock_settings):
        """Test complete token creation, verification, and cookie management."""
        user_data = {"sub": "testuser", "user_id": "123", "role": "admin"}

        # Create refresh token with remember me
        refresh_token = TokenManager.create_refresh_token(user_data, remember_me=True)

        # Set cookie
        TokenManager.set_refresh_cookie(mock_response, refresh_token, remember_me=True)

        # Verify token
        payload = TokenManager.verify_refresh_token(refresh_token)

        assert payload["sub"] == "testuser"
        assert payload["user_id"] == "123"
        assert payload["role"] == "admin"
        assert payload["remember_me"] is True
        assert "jti" in payload

        # Verify cookie was set correctly
        mock_response.set_cookie.assert_called_once()

        # Create access token from refresh payload
        access_token = TokenManager.create_access_token({
            "sub": payload["sub"],
            "user_id": payload["user_id"],
            "role": payload["role"],
        })

        access_payload = jwt.decode(
            access_token, mock_settings.SECRET_KEY, algorithms=["HS256"]
        )
        assert access_payload["sub"] == "testuser"
        assert access_payload["type"] == "access"

        # Clean up - unset cookie
        TokenManager.unset_refresh_cookie(mock_response)
        mock_response.delete_cookie.assert_called_once()

    def test_token_rotation_simulation(self, mock_settings):
        """Test token rotation by creating new tokens from old payload."""
        original_data = {"sub": "testuser", "user_id": "123"}

        # Create initial refresh token
        old_refresh_token = TokenManager.create_refresh_token(
            original_data, remember_me=True
        )
        old_payload = TokenManager.verify_refresh_token(old_refresh_token)

        # Create new refresh token (simulating rotation)
        new_refresh_token = TokenManager.create_refresh_token(
            {"sub": old_payload["sub"], "user_id": old_payload["user_id"]},
            remember_me=old_payload["remember_me"],
        )

        new_payload = TokenManager.verify_refresh_token(new_refresh_token)

        # Should have same user data but different JTI
        assert new_payload["sub"] == old_payload["sub"]
        assert new_payload["user_id"] == old_payload["user_id"]
        assert new_payload["remember_me"] == old_payload["remember_me"]
        assert new_payload["jti"] != old_payload["jti"]  # Different JTI for security
