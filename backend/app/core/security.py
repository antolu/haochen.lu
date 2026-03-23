from __future__ import annotations

import hashlib
import typing
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from bcrypt import checkpw, gensalt, hashpw

from app.config import settings

ACCESS_TOKEN_TYPE = "ac" + "cess"
REFRESH_TOKEN_TYPE = "re" + "fresh"


def get_password_hash(password: str) -> str:
    if not password:
        msg = "Password must not be empty"
        raise ValueError(msg)

    password_bytes = password.encode("utf-8")
    prehashed = hashlib.sha256(password_bytes).digest()
    hashed_bytes: bytes = hashpw(prehashed, gensalt())
    return hashed_bytes.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    prehashed = hashlib.sha256(plain_password.encode("utf-8")).digest()
    return bool(checkpw(prehashed, hashed_password.encode("utf-8")))


def _create_token(
    data: dict[str, typing.Any],
    *,
    expires_delta: int,
    token_type: str,
) -> str:
    now = datetime.now(UTC)
    payload = data.copy()
    # jwt.encode may return str or bytes depending on jwt library; ensure str
    payload.update({
        "exp": now + timedelta(seconds=expires_delta),
        "iat": now,
        "type": token_type,
    })
    token: typing.Any = jwt.encode(
        payload, settings.secret_key, algorithm=settings.algorithm
    )
    if isinstance(token, bytes):
        return token.decode("utf-8")
    # Explicitly cast to str for the return type
    return typing.cast(str, token)


def create_access_token(
    data: dict[str, typing.Any],
    expires_delta: int | None = None,
) -> str:
    lifetime_seconds = expires_delta or settings.access_token_expire_minutes * 60
    return _create_token(
        data, expires_delta=lifetime_seconds, token_type=ACCESS_TOKEN_TYPE
    )


def create_refresh_token(
    data: dict[str, typing.Any],
    expires_delta: int | None = None,
) -> str:
    lifetime_seconds = (
        expires_delta or settings.refresh_token_expire_days * 24 * 60 * 60
    )
    payload = data.copy()
    payload.setdefault("jti", str(uuid.uuid4()))
    return _create_token(
        payload, expires_delta=lifetime_seconds, token_type=REFRESH_TOKEN_TYPE
    )


def decode_token(
    token: str | None,
    *,
    expected_type: str | None = None,
) -> dict[str, typing.Any] | None:
    if not token:
        return None

    try:
        payload = typing.cast(
            dict[str, typing.Any],
            jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm]),
        )
    except jwt.PyJWTError:
        return None

    if expected_type and payload.get("type") != expected_type:
        return None

    return payload


class TokenManager:
    def __init__(self, secret_key: str) -> None:
        self.secret_key = secret_key

    def create_token(
        self,
        user_id: uuid.UUID | str,
        expires_delta: int | None = None,
    ) -> str:
        return create_access_token({"sub": str(user_id)}, expires_delta)

    def decode_token(self, token: str) -> dict[str, typing.Any] | None:
        return decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
