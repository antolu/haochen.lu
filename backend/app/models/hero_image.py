"""Hero image model for managing homepage hero images."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.photo import Photo


class HeroImage(Base):
    """Model for storing hero images with focal point configuration."""

    __tablename__ = "hero_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False
    )

    focal_point_x: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)
    focal_point_y: Mapped[float] = mapped_column(Float, nullable=False, default=50.0)

    focal_points_responsive: Mapped[dict[str, dict[str, Any]] | None] = mapped_column(
        JSON, nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    photo: Mapped[Photo] = relationship("Photo", lazy="select")

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
