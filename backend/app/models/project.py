from __future__ import annotations

import uuid
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False)
    description = Column(Text, nullable=False)
    short_description = Column(String(500))
    
    # URLs
    github_url = Column(String(500))
    demo_url = Column(String(500))
    image_url = Column(String(500))
    
    # Technologies (JSON string)
    technologies = Column(Text)
    
    # Status
    featured = Column(Boolean, default=False)
    status = Column(String(50), default="active")  # active, archived, in_progress
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)