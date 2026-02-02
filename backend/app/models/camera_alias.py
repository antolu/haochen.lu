from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CameraAlias(Base):
    __tablename__ = "camera_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    original_name = Column(String(200), nullable=False, index=True)  # Raw EXIF data
    display_name = Column(String(200), nullable=False)  # User-friendly name
    brand = Column(String(100))  # Normalized brand (Sony, Canon, Nikon, etc.)
    model = Column(String(100))  # Normalized model name
    notes = Column(Text)  # Optional notes about the alias
    is_active = Column(Boolean, default=True, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Create indexes for efficient lookups
    __table_args__ = (
        Index("ix_camera_aliases_original_name_active", "original_name", "is_active"),
        Index("ix_camera_aliases_brand_model", "brand", "model"),
    )
