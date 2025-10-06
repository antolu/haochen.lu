from __future__ import annotations

import uuid
from datetime import datetime

from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    """User schema for responses"""

    username: str
    is_admin: bool
    created_at: datetime
    updated_at: datetime | None


class UserCreate(schemas.BaseUserCreate):
    """User schema for creation"""

    username: str


class UserUpdate(schemas.BaseUserUpdate):
    """User schema for updates"""

    username: str | None = None
