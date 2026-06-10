from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class SystemSetting(Base):
    """Model for storing global system settings."""

    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # Image Processing Settings
    responsive_sizes: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    quality_settings: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False)
    avif_quality_base_offset: Mapped[int] = mapped_column(Integer, nullable=False)
    avif_quality_floor: Mapped[int] = mapped_column(Integer, nullable=False)
    avif_effort_default: Mapped[int] = mapped_column(Integer, nullable=False)
    webp_quality: Mapped[int] = mapped_column(Integer, nullable=False)

    # Rate Limiting Settings
    rate_limit_enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    rate_limit_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    rate_limit_period: Mapped[int] = mapped_column(
        Integer, nullable=False, default=3600
    )
    rate_limit_file_calls: Mapped[int] = mapped_column(
        Integer, nullable=False, default=20
    )
    rate_limit_file_period: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    rate_limit_auth_calls: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )
    rate_limit_auth_period: Mapped[int] = mapped_column(
        Integer, nullable=False, default=60
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        return f"<SystemSetting(id={self.id}, rate_limit_enabled={self.rate_limit_enabled})>"
