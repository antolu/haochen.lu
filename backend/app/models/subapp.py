from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SubApp(Base):
    __tablename__ = "subapps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    description = Column(Text)

    # Display
    icon = Column(String(100))  # Icon class or URL
    color = Column(String(7))  # Hex color

    # URLs
    url = Column(String(500), nullable=False)
    is_external = Column(Boolean, default=False)

    # Access control
    requires_auth = Column(Boolean, default=True)
    admin_only = Column(Boolean, default=False)

    # Display settings
    order = Column(Integer, default=0)
    enabled = Column(Boolean, default=True)
    show_in_menu = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
