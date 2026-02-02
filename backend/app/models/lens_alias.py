from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class LensAlias(Base):
    __tablename__ = "lens_aliases"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True)
    original_name = Column(
        String(300), nullable=False, index=True
    )  # Raw EXIF data (longer for lens names)
    display_name = Column(String(300), nullable=False)  # User-friendly name
    brand = Column(String(100))  # Lens manufacturer (Sony, Canon, Sigma, Tamron, etc.)
    model = Column(String(200))  # Lens model/series
    mount_type = Column(String(50))  # Camera mount (E-mount, EF, RF, F, etc.)
    focal_length = Column(String(100))  # Focal length range (24-70mm, 85mm, etc.)
    max_aperture = Column(String(50))  # Maximum aperture (f/2.8, f/1.4, etc.)
    lens_type = Column(String(50))  # Prime, Zoom, Macro, etc.
    notes = Column(Text)  # Optional notes about the lens
    is_active = Column(Boolean, default=True, nullable=False)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Create indexes for efficient lookups
    __table_args__ = (
        Index("ix_lens_aliases_original_name_active", "original_name", "is_active"),
        Index("ix_lens_aliases_brand_mount", "brand", "mount_type"),
        Index("ix_lens_aliases_focal_length", "focal_length"),
    )
