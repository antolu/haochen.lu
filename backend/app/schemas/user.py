from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """Base user schema"""

    email: EmailStr
    username: str | None = None
    is_admin: bool = False


class UserCreate(UserBase):
    """User schema for creation (e.g. on first login sync)"""

    oidc_id: str


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    username: str | None = None
    is_admin: bool | None = None


class UserRead(UserBase):
    """User schema for responses"""

    id: uuid.UUID
    oidc_id: str
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)
