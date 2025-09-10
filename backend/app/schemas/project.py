from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ProjectBase(BaseModel):
    title: str
    description: str
    short_description: str | None = None
    github_url: str | None = None
    demo_url: str | None = None
    image_url: str | None = None
    technologies: str | None = None  # JSON string
    featured: bool = False
    status: str = "active"


class ProjectCreate(ProjectBase):
    slug: str | None = None


class ProjectUpdate(ProjectBase):
    title: str | None = None
    description: str | None = None
    featured: bool | None = None
    status: str | None = None


class ProjectResponse(ProjectBase):
    id: str
    slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int
