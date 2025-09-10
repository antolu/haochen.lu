from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    slug = Column(String(200), unique=True, nullable=False)
    excerpt = Column(String(500))
    content = Column(Text, nullable=False)

    # Publishing
    published = Column(Boolean, default=False)
    published_at = Column(DateTime)

    # SEO
    meta_description = Column(String(160))
    featured_image = Column(String(500))

    # Tags and categories
    tags = Column(Text)  # JSON string
    category = Column(String(100))

    # Stats
    view_count = Column(Integer, default=0)
    read_time = Column(Integer)  # minutes

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
