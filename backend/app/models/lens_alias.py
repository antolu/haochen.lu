from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LensAlias(Base):
    __tablename__ = "lens_aliases"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, index=True
    )
    original_name: Mapped[str] = mapped_column(String(300), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(300), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(200))
    mount_type: Mapped[str | None] = mapped_column(String(50))
    focal_length: Mapped[str | None] = mapped_column(String(100))
    max_aperture: Mapped[str | None] = mapped_column(String(50))
    lens_type: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        Index("ix_lens_aliases_original_name_active", "original_name", "is_active"),
        Index("ix_lens_aliases_brand_mount", "brand", "mount_type"),
        Index("ix_lens_aliases_focal_length", "focal_length"),
    )
