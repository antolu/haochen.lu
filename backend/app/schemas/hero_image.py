"""Hero image schemas for API requests and responses."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator

from app.schemas.photo import PhotoResponse


class FocalPoint(BaseModel):
    """Focal point coordinates."""

    x: float
    y: float

    @field_validator("x", "y")
    @classmethod
    def validate_percentage(cls, v):
        """Validate focal point is between 0 and 100."""
        if not 0 <= v <= 100:
            msg = "Focal point coordinates must be between 0 and 100"
            raise ValueError(msg)
        return v


class ResponsiveFocalPoints(BaseModel):
    """Responsive focal points for different devices."""

    mobile: FocalPoint | None = None
    tablet: FocalPoint | None = None
    desktop: FocalPoint | None = None


class HeroImageBase(BaseModel):
    """Base hero image schema."""

    title: str
    photo_id: UUID
    focal_point_x: float = 50.0
    focal_point_y: float = 50.0
    focal_points_responsive: ResponsiveFocalPoints | None = None

    @field_validator("focal_point_x", "focal_point_y")
    @classmethod
    def validate_focal_point(cls, v):
        """Validate focal point is between 0 and 100."""
        if not 0 <= v <= 100:
            msg = "Focal point coordinates must be between 0 and 100"
            raise ValueError(msg)
        return v


class HeroImageCreate(HeroImageBase):
    """Schema for creating a hero image."""


class HeroImageUpdate(BaseModel):
    """Schema for updating a hero image."""

    title: str | None = None
    focal_point_x: float | None = None
    focal_point_y: float | None = None
    focal_points_responsive: ResponsiveFocalPoints | None = None

    @field_validator("focal_point_x", "focal_point_y")
    @classmethod
    def validate_focal_point(cls, v):
        """Validate focal point is between 0 and 100."""
        if v is not None and not 0 <= v <= 100:
            msg = "Focal point coordinates must be between 0 and 100"
            raise ValueError(msg)
        return v


class HeroImageFocalPointUpdate(BaseModel):
    """Schema for updating only focal points."""

    focal_point_x: float
    focal_point_y: float
    focal_points_responsive: ResponsiveFocalPoints | None = None

    @field_validator("focal_point_x", "focal_point_y")
    @classmethod
    def validate_focal_point(cls, v):
        """Validate focal point is between 0 and 100."""
        if not 0 <= v <= 100:
            msg = "Focal point coordinates must be between 0 and 100"
            raise ValueError(msg)
        return v


class HeroImageResponse(HeroImageBase):
    """Schema for hero image responses."""

    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
    photo: PhotoResponse

    class Config:
        from_attributes = True

    @property
    def focal_point_css(self) -> str:
        """Generate CSS object-position value."""
        return f"{self.focal_point_x}% {self.focal_point_y}%"

    def get_responsive_focal_point_css(self, device: str) -> str:
        """Get CSS object-position for specific device."""
        if not self.focal_points_responsive:
            return self.focal_point_css

        device_point = getattr(self.focal_points_responsive, device, None)
        if device_point:
            return f"{device_point.x}% {device_point.y}%"

        return self.focal_point_css


class HeroImageActivate(BaseModel):
    """Schema for activating a hero image."""

    # No additional fields needed, just the endpoint call
