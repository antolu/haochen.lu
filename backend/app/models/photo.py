from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(50))
    tags = Column(String(500))  # JSON string of tags
    comments = Column(Text)

    # File paths
    filename = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)

    # Responsive image variants (JSON: {size_name: {path, width, height, size_bytes, format}})
    variants = Column(JSON, nullable=False)

    # EXIF data
    location_lat = Column(Float)
    location_lon = Column(Float)
    location_name = Column(String(200))
    location_address = Column(Text)  # Full geocoded address
    altitude = Column(Float)  # GPS altitude in meters
    timezone = Column(String(50))  # Timezone offset or name
    camera_make = Column(String(100))
    camera_model = Column(String(100))
    lens = Column(String(100))
    iso = Column(Integer)
    aperture = Column(Float)
    shutter_speed = Column(String(50))
    focal_length = Column(Integer)
    date_taken = Column(DateTime)

    # Flexible metadata storage
    custom_metadata = Column(JSON)  # Additional custom metadata fields

    # Metadata
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    featured = Column(Boolean, default=False)
    order = Column(Integer, default=0)
    view_count = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
