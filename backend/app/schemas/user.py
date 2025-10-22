from __future__ import annotations

import uuid
from datetime import datetime

from fastapi_users import schemas
from pydantic import field_validator


class UserRead(schemas.BaseUser[uuid.UUID]):
    """User schema for responses"""

    username: str
    is_admin: bool
    created_at: datetime
    updated_at: datetime | None
    email: str | None  # Override to allow None for legacy users

    @field_validator("email", mode="before")
    @classmethod
    def convert_none_email(cls, v: str | None) -> str:
        """Convert None email to empty string for legacy users"""
        return v if v is not None else ""


class UserCreate(schemas.BaseUserCreate):
    """User schema for creation"""

    username: str


class UserUpdate(schemas.BaseUserUpdate):
    """User schema for updates"""

    username: str | None = None
