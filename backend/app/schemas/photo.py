from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class PhotoBase(BaseModel):
    title: str
    description: str | None = None
    category: str | None = None
    tags: str | None = None
    comments: str | None = None
    featured: bool = False


class PhotoCreate(PhotoBase):
    pass


class PhotoUpdate(PhotoBase):
    title: str | None = None
    featured: bool | None = None


class PhotoResponse(PhotoBase):
    id: str
    filename: str
    original_path: str
    webp_path: str
    thumbnail_path: str | None
    
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
    
    class Config:
        from_attributes = True


class PhotoListResponse(BaseModel):
    photos: list[PhotoResponse]
    total: int
    page: int
    per_page: int
    pages: int