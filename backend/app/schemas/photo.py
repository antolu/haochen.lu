from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class PhotoBase(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    tags: str | None = None
    comments: str | None = None
    featured: bool = False


class PhotoCreate(PhotoBase):
    pass


class PhotoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    category: str | None = None
    tags: str | None = None
    comments: str | None = None
    featured: bool | None = None


class ImageVariant(BaseModel):
    """Individual image variant details."""

    path: str
    filename: str
    width: int
    height: int
    size_bytes: int
    format: str


class PhotoResponse(PhotoBase):
    id: str | UUID
    filename: str
    original_path: str
    webp_path: str  # Legacy, kept for compatibility
    thumbnail_path: str | None  # Legacy, kept for compatibility

    # Responsive image variants
    variants: dict[str, ImageVariant] | None = None

    # EXIF data
    location_lat: float | None
    location_lon: float | None
    location_name: str | None
    camera_make: str | None
    camera_model: str | None
    lens: str | None
    iso: int | None
    aperture: float | None
    shutter_speed: str | None
    focal_length: int | None
    date_taken: datetime | None

    # Metadata
    file_size: int
    width: int
    height: int
    view_count: int
    order: int
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class PhotoListResponse(BaseModel):
    photos: list[PhotoResponse]
    total: int
    page: int
    per_page: int
    pages: int
