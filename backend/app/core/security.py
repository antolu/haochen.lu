"""Security utilities for token management."""

from __future__ import annotations

import typing
import uuid

from bcrypt import checkpw, gensalt, hashpw
from fastapi_users.jwt import decode_jwt, generate_jwt

from app.config import settings


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt.

    Args:
        password: Plain text password to hash

    Returns:
        Hashed password string
    """
    if not password:
        msg = "Password must not be empty"
        raise ValueError(msg)
    return typing.cast(str, hashpw(password.encode("utf-8"), gensalt()).decode("utf-8"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash.

    Args:
        plain_password: Plain text password to verify
        hashed_password: Hashed password to compare against

    Returns:
        True if password matches, False otherwise
    """
    return typing.cast(
        bool, checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    )


def create_access_token(
    data: dict[str, typing.Any],
    expires_delta: int | None = None,
) -> str:
    """Create JWT access token.

    Args:
        data: Dictionary containing the token payload (e.g., {"sub": "username"})
        expires_delta: Token lifetime in seconds (defaults to 3600)

    Returns:
        Encoded JWT token string
    """
    lifetime_seconds = expires_delta if expires_delta is not None else 3600

    # Prepare token data with sub field
    token_data = data.copy()
    # Add audience claim required by fastapi-users
    token_data["aud"] = ["fastapi-users:auth"]

    # Generate token using fastapi-users JWT utility
    return typing.cast(
        str,
        generate_jwt(
            token_data,
            secret=settings.secret_key,
            lifetime_seconds=lifetime_seconds,
        ),
    )


def decode_token(token: str) -> dict[str, typing.Any] | None:
    """Decode and verify JWT token.

    Args:
        token: JWT token string to decode

    Returns:
        Token payload dictionary if valid, None otherwise
    """
    try:
        return typing.cast(
            dict[str, typing.Any] | None,
            decode_jwt(
                token,
                secret=settings.secret_key,
                audience=["fastapi-users:auth"],
            ),
        )
    except Exception:
        return None


class TokenManager:
    """Token manager for authentication (compatibility layer)."""

    def __init__(self, secret_key: str) -> None:
        """Initialize token manager.

        Args:
            secret_key: Secret key for JWT signing
        """
        self.secret_key = secret_key

    def create_token(
        self,
        user_id: uuid.UUID | str,
        expires_delta: int | None = None,
    ) -> str:
        """Create access token for user.

        Args:
            user_id: User ID to encode in token
            expires_delta: Token lifetime in seconds

        Returns:
            Encoded JWT token
        """
        data = {"sub": str(user_id)}
        return create_access_token(data, expires_delta)

    def decode_token(self, token: str) -> dict[str, typing.Any] | None:
        """Decode and verify token.

        Args:
            token: JWT token to decode

        Returns:
            Token payload if valid, None otherwise
        """
        return decode_token(token)
