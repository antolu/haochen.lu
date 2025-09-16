from __future__ import annotations

import calendar
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import Response
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(
    data: dict[str, Any], expires_delta: timedelta | None = None
) -> str:
    to_encode = data.copy()
    now = datetime.utcnow()
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update(
        {
            "exp": calendar.timegm(expire.utctimetuple()),
            "iat": calendar.timegm(now.utctimetuple()),
            "type": "access",
        }
    )
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    if not password or not password.strip():
        raise ValueError("Password cannot be empty")
    return pwd_context.hash(password)


def decode_token(token: str | None) -> dict[str, Any] | None:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload
    except (JWTError, AttributeError):
        return None


class TokenManager:
    """Enhanced token manager for session persistence"""

    @staticmethod
    def create_access_token(
        data: dict[str, Any], expires_delta: timedelta | None = None
    ) -> str:
        """Create access token with user data"""
        to_encode = data.copy()
        now = datetime.utcnow()
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=settings.access_token_expire_minutes)

        to_encode.update(
            {
                "exp": calendar.timegm(expire.utctimetuple()),
                "iat": calendar.timegm(now.utctimetuple()),
                "type": "access",
            }
        )

        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)

    @staticmethod
    def create_refresh_token(data: dict[str, Any], remember_me: bool = False) -> str:
        """Create refresh token with remember me support"""
        to_encode = data.copy()

        # Set expiration based on remember me flag
        if remember_me:
            expire = datetime.utcnow() + timedelta(
                days=settings.refresh_token_expire_days
            )
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=settings.refresh_token_expire_minutes
            )

        # Generate unique JWT ID for revocation
        jti = str(uuid.uuid4())

        to_encode.update(
            {
                "exp": calendar.timegm(expire.utctimetuple()),
                "iat": calendar.timegm(datetime.utcnow().utctimetuple()),
                "type": "refresh",
                "remember_me": remember_me,
                "jti": jti,
            }
        )

        return jwt.encode(
            to_encode, settings.session_secret_key, algorithm=settings.algorithm
        )

    @staticmethod
    def verify_refresh_token(token: str) -> dict[str, Any] | None:
        """Verify and decode refresh token"""
        try:
            payload = jwt.decode(
                token, settings.session_secret_key, algorithms=[settings.algorithm]
            )
            if payload.get("type") != "refresh":
                return None
            return payload
        except JWTError:
            return None

    @staticmethod
    def set_refresh_cookie(
        response: Response, token: str, remember_me: bool = False
    ) -> None:
        """Set HttpOnly refresh token cookie"""
        if remember_me:
            max_age = (
                settings.refresh_token_expire_days * 24 * 60 * 60
            )  # days to seconds
        else:
            max_age = settings.refresh_token_expire_minutes * 60  # minutes to seconds

        response.set_cookie(
            key=settings.refresh_cookie_name,
            value=token,
            max_age=max_age,
            httponly=settings.cookie_httponly,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            domain=settings.cookie_domain,
        )

    @staticmethod
    def clear_refresh_cookie(response: Response) -> None:
        """Clear refresh token cookie"""
        response.delete_cookie(
            key=settings.refresh_cookie_name,
            httponly=settings.cookie_httponly,
            secure=settings.cookie_secure,
            samesite=settings.cookie_samesite,
            domain=settings.cookie_domain,
        )
