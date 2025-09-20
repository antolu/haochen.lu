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

    # Location updates
    location_lat: float | None = None
    location_lon: float | None = None
    location_name: str | None = None
    location_address: str | None = None
    altitude: float | None = None
    timezone: str | None = None

    @field_validator("location_lat")
    @classmethod
    def validate_latitude(cls, v):
        if v is not None and not (-90 <= v <= 90):
            msg = "Latitude must be between -90 and 90"
            raise ValueError(msg)
        return v

    @field_validator("location_lon")
    @classmethod
    def validate_longitude(cls, v):
        if v is not None and not (-180 <= v <= 180):
            msg = "Longitude must be between -180 and 180"
            raise ValueError(msg)
        return v

    @field_validator("location_name", "location_address")
    @classmethod
    def validate_location_string(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
            if len(v) > 500:
                msg = "Location string too long (max 500 characters)"
                raise ValueError(msg)
        return v

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
            if len(v) > 50:
                msg = "Timezone string too long (max 50 characters)"
                raise ValueError(msg)
        return v

    # Technical metadata updates
    camera_make: str | None = None
    camera_model: str | None = None
    lens: str | None = None
    iso: int | None = None
    aperture: float | None = None
    shutter_speed: str | None = None
    focal_length: int | None = None
    date_taken: datetime | None = None

    @field_validator("camera_make", "camera_model", "lens", "shutter_speed")
    @classmethod
    def validate_camera_string(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) == 0:
                return None
            if len(v) > 100:
                msg = "Camera string too long (max 100 characters)"
                raise ValueError(msg)
        return v

    @field_validator("iso")
    @classmethod
    def validate_iso(cls, v):
        if v is not None and not (1 <= v <= 10000000):
            msg = "ISO must be between 1 and 10,000,000"
            raise ValueError(msg)
        return v

    @field_validator("aperture")
    @classmethod
    def validate_aperture(cls, v):
        if v is not None and not (0.1 <= v <= 100):
            msg = "Aperture must be between 0.1 and 100"
            raise ValueError(msg)
        return v

    @field_validator("focal_length")
    @classmethod
    def validate_focal_length(cls, v):
        if v is not None and not (1 <= v <= 10000):
            msg = "Focal length must be between 1 and 10,000mm"
            raise ValueError(msg)
        return v

    # Flexible metadata
    custom_metadata: dict | None = None


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

    # Responsive image variants
    variants: dict[str, ImageVariant]

    # EXIF data
    location_lat: float | None
    location_lon: float | None
    location_name: str | None
    location_address: str | None
    altitude: float | None
    timezone: str | None
    camera_make: str | None
    camera_model: str | None
    camera_display_name: str | None = (
        None  # Display name from alias or fallback to original
    )
    lens: str | None
    lens_display_name: str | None = (
        None  # Display name from alias or fallback to original
    )
    iso: int | None
    aperture: float | None
    shutter_speed: str | None
    focal_length: int | None
    date_taken: datetime | None

    # Flexible metadata
    custom_metadata: dict | None

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


class PhotoReorderItem(BaseModel):
    id: str | UUID
    order: int


class PhotoReorderRequest(BaseModel):
    items: list[PhotoReorderItem]
    normalize: bool = False


class PhotoLocationResponse(BaseModel):
    """Minimal photo data for map display"""

    id: str | UUID
    title: str
    location_lat: float
    location_lon: float
    thumbnail_url: str | None = None

    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid_to_string(cls, v: UUID | str) -> str:
        return str(v) if isinstance(v, UUID) else v


class PhotoLocationsResponse(BaseModel):
    """Response for photo locations endpoint"""

    locations: list[PhotoLocationResponse]
    total: int
