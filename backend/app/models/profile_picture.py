from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID

from app.database import Base


class ProfilePicture(Base):
    __tablename__ = "profile_pictures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200))  # Optional description
    filename = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)

    # Responsive square image variants (JSON: {size_name: {path, width, height, size_bytes, format}})
    variants = Column(JSON, nullable=False)

    # Only one profile picture can be active at a time
    is_active = Column(Boolean, default=False, nullable=False)

    # Square image metadata (width should equal height)
    file_size = Column(Integer)
    width = Column(Integer)  # Should equal height for squares
    height = Column(Integer)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
