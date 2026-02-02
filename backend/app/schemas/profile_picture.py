from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, field_validator


class ProfilePictureBase(BaseModel):
    title: str | None = None
    is_active: bool = False


class ProfilePictureCreate(ProfilePictureBase):
    pass


class ProfilePictureUpdate(BaseModel):
    title: str | None = None
    is_active: bool | None = None


class ProfilePictureResponse(ProfilePictureBase):
    id: str
    filename: str
    original_path: str
    variants: dict[str, Any]
    file_size: int | None = None
    width: int | None = None
    height: int | None = None
    created_at: datetime
    updated_at: datetime

    # URL fields (populated by API)
    original_url: str | None = None
    download_url: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid_to_string(cls, v: UUID | str) -> str:
        """Convert UUID to string for JSON serialization."""
        return str(v) if isinstance(v, UUID) else v

    class Config:
        from_attributes = True


class ProfilePictureListResponse(BaseModel):
    profile_pictures: list[ProfilePictureResponse]
    total: int


class ActiveProfilePictureResponse(BaseModel):
    profile_picture: ProfilePictureResponse | None = None
