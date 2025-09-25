from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class ProjectBase(BaseModel):
    title: str
    description: str
    short_description: str | None = None
    github_url: str | None = None
    demo_url: str | None = None
    image_url: str | None = None
    repository_type: str | None = None  # 'github', 'gitlab', or None
    repository_owner: str | None = None
    repository_name: str | None = None
    use_readme: bool = False
    technologies: str | None = None  # JSON string
    featured: bool = False
    status: str = "active"


class ProjectCreate(ProjectBase):
    slug: str | None = None


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    github_url: str | None = None
    demo_url: str | None = None
    image_url: str | None = None
    repository_type: str | None = None
    repository_owner: str | None = None
    repository_name: str | None = None
    use_readme: bool | None = None
    technologies: str | None = None
    featured: bool | None = None
    status: str | None = None


class ProjectResponse(ProjectBase):
    id: str
    slug: str
    readme_content: str | None = None
    readme_last_updated: datetime | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, UUID):
            return str(v)
        return v

    class Config:
        from_attributes = True


class ReadmeResponse(BaseModel):
    content: str
    source: str | None = None  # 'github', 'gitlab'
    last_updated: datetime | None = None


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int


class ReorderItem(BaseModel):
    id: str
    order: int


class ProjectReorderRequest(BaseModel):
    items: list[ReorderItem]
    normalize: bool = True
