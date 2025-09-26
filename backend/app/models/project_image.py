from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProjectImage(Base):
    __tablename__ = "project_images"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Legacy link to photos table (deprecated). New uploads store files directly.
    photo_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=True
    )

    # Direct storage for project image files (new path)
    filename: Mapped[str | None] = mapped_column(String(255))
    original_path: Mapped[str | None] = mapped_column(String(500))
    variants: Mapped[dict | None] = mapped_column(JSON)

    # Optional metadata
    title: Mapped[str | None] = mapped_column(String(200))
    alt_text: Mapped[str | None] = mapped_column(String(300))

    order: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships (deprecated): intentionally no relationship to Photo to avoid coupling
