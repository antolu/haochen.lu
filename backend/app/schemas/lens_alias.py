from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LensAliasBase(BaseModel):
    original_name: str = Field(..., description="Original lens name from EXIF")
    display_name: str = Field(..., description="User-friendly display name")
    brand: str | None = Field(None, description="Lens manufacturer")
    model: str | None = Field(None, description="Lens model/series")
    mount_type: str | None = Field(None, description="Camera mount type")
    focal_length: str | None = Field(None, description="Focal length range")
    max_aperture: str | None = Field(None, description="Maximum aperture")
    lens_type: str | None = Field(
        None, description="Lens type (Prime, Zoom, Macro, etc.)"
    )
    notes: str | None = Field(None, description="Optional notes about the lens")
    is_active: bool = Field(default=True, description="Whether the alias is active")


class LensAliasCreate(LensAliasBase):
    pass


class LensAliasUpdate(BaseModel):
    original_name: str | None = None
    display_name: str | None = None
    brand: str | None = None
    model: str | None = None
    mount_type: str | None = None
    focal_length: str | None = None
    max_aperture: str | None = None
    lens_type: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class LensAliasResponse(LensAliasBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LensAliasListResponse(BaseModel):
    aliases: list[LensAliasResponse]
    total: int
    page: int
    per_page: int
    pages: int


class LensDiscoveryItem(BaseModel):
    original_name: str
    photo_count: int
    has_alias: bool


class LensDiscoveryResponse(BaseModel):
    lenses: list[LensDiscoveryItem]
    total_unique_lenses: int
    total_photos: int
