from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CameraAliasBase(BaseModel):
    original_name: str = Field(..., description="Original camera name from EXIF")
    display_name: str = Field(..., description="User-friendly display name")
    brand: str | None = Field(None, description="Normalized brand name")
    model: str | None = Field(None, description="Normalized model name")
    notes: str | None = Field(None, description="Optional notes about the alias")
    is_active: bool = Field(True, description="Whether the alias is active")


class CameraAliasCreate(CameraAliasBase):
    pass


class CameraAliasUpdate(BaseModel):
    original_name: str | None = None
    display_name: str | None = None
    brand: str | None = None
    model: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class CameraAliasResponse(CameraAliasBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CameraAliasListResponse(BaseModel):
    aliases: list[CameraAliasResponse]
    total: int
    page: int
    per_page: int
    pages: int


class CameraDiscoveryItem(BaseModel):
    original_name: str
    camera_make: str | None
    camera_model: str | None
    photo_count: int
    has_alias: bool


class CameraDiscoveryResponse(BaseModel):
    cameras: list[CameraDiscoveryItem]
    total_unique_cameras: int
    total_photos: int
