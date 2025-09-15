from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    short_description: Mapped[str | None] = mapped_column(String(500))

    # URLs
    github_url: Mapped[str | None] = mapped_column(String(500))
    demo_url: Mapped[str | None] = mapped_column(String(500))
    image_url: Mapped[str | None] = mapped_column(String(500))

    # Repository Integration
    repository_type: Mapped[str | None] = mapped_column(
        String(20)
    )  # 'github', 'gitlab', or None
    repository_owner: Mapped[str | None] = mapped_column(String(100))  # username/org
    repository_name: Mapped[str | None] = mapped_column(String(100))  # repo name
    use_readme: Mapped[bool] = mapped_column(Boolean, default=False)
    readme_content: Mapped[str | None] = mapped_column(Text)  # cached README content
    readme_last_updated: Mapped[datetime | None] = mapped_column(DateTime)

    # Technologies (JSON string)
    technologies: Mapped[str | None] = mapped_column(Text)

    # Status
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(
        String(50), default="active"
    )  # active, archived, in_progress

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
