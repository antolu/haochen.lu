from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[str | None] = mapped_column(String(500))

    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_path: Mapped[str] = mapped_column(String(500), nullable=False)

    variants: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    location_lat: Mapped[float | None] = mapped_column(Float)
    location_lon: Mapped[float | None] = mapped_column(Float)
    location_name: Mapped[str | None] = mapped_column(String(200))
    location_address: Mapped[str | None] = mapped_column(Text)
    altitude: Mapped[float | None] = mapped_column(Float)
    timezone: Mapped[str | None] = mapped_column(String(50))
    camera_make: Mapped[str | None] = mapped_column(String(100))
    camera_model: Mapped[str | None] = mapped_column(String(100))
    lens: Mapped[str | None] = mapped_column(String(100))
    iso: Mapped[int | None] = mapped_column(Integer)
    aperture: Mapped[float | None] = mapped_column(Float)
    shutter_speed: Mapped[str | None] = mapped_column(String(50))
    focal_length: Mapped[int | None] = mapped_column(Integer)
    date_taken: Mapped[datetime | None] = mapped_column(DateTime)

    custom_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSON)

    access_level: Mapped[str] = mapped_column(
        ENUM(
            "public", "authenticated", "private", name="accesslevel", create_type=False
        ),
        default="public",
        nullable=False,
    )

    file_size: Mapped[int | None] = mapped_column(Integer)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
