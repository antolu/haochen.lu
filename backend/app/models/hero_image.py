"""Hero image model for managing homepage hero images."""

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class HeroImage(Base):
    """Model for storing hero images with focal point configuration."""

    __tablename__ = "hero_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    photo_id = Column(
        UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False
    )

    # Focal point coordinates (0-100 percentages)
    focal_point_x = Column(Float, nullable=False, default=50.0)
    focal_point_y = Column(Float, nullable=False, default=50.0)

    # Responsive focal points for different devices
    # JSON format: {"mobile": {"x": 70, "y": 50}, "tablet": {"x": 60, "y": 50}, "desktop": {"x": 55, "y": 50}}
    focal_points_responsive = Column(JSON, nullable=True)

    # Only one hero image can be active at a time
    is_active = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    photo = relationship("Photo", lazy="select")

    def __repr__(self) -> str:
        return f"<HeroImage(title='{self.title}', active={self.is_active})>"

    @property
    def focal_point_css(self) -> str:
        """Generate CSS object-position value from focal point."""
        return f"{self.focal_point_x}% {self.focal_point_y}%"

    def get_responsive_focal_point(self, device: str) -> dict[str, float]:
        """Get focal point for specific device, fallback to default."""
        if not self.focal_points_responsive:
            return {"x": float(self.focal_point_x), "y": float(self.focal_point_y)}

        device_point = self.focal_points_responsive.get(device)
        if device_point and "x" in device_point and "y" in device_point:
            return {"x": float(device_point["x"]), "y": float(device_point["y"])}

        return {"x": float(self.focal_point_x), "y": float(self.focal_point_y)}

    def get_responsive_focal_point_css(self, device: str) -> str:
        """Generate CSS object-position value for specific device."""
        point = self.get_responsive_focal_point(device)
        return f"{point['x']}% {point['y']}%"
