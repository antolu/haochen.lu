"""Content model for managing editable website text."""

from uuid import uuid4
from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID

from ..database import Base


class Content(Base):
    """Model for storing editable website content."""

    __tablename__ = "content"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    key = Column(String(100), unique=True, nullable=False)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    content_type = Column(
        String(50), nullable=False, default="text"
    )  # text, html, markdown
    category = Column(
        String(50), nullable=False, default="general"
    )  # hero, about, contact, etc.
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self):
        return f"<Content(key='{self.key}', title='{self.title}')>"
