from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Application(Base):
    __tablename__ = "subapps"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    icon: Mapped[str | None] = mapped_column(String(100))
    color: Mapped[str | None] = mapped_column(String(7))

    url: Mapped[str] = mapped_column(String(500), nullable=False)
    admin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_external: Mapped[bool] = mapped_column(Boolean, default=False)

    requires_auth: Mapped[bool] = mapped_column(Boolean, default=True)
    admin_only: Mapped[bool] = mapped_column(Boolean, default=False)

    client_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True
    )
    client_secret: Mapped[str | None] = mapped_column(String(100), nullable=True)
    redirect_uris: Mapped[str | None] = mapped_column(Text, nullable=True)

    order: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    show_in_menu: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
