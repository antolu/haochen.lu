from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class BlogPostBase(BaseModel):
    title: str
    content: str
    excerpt: str | None = None
    meta_description: str | None = None
    featured_image: str | None = None
    tags: str | None = None
    category: str | None = None
    published: bool = False


class BlogPostCreate(BlogPostBase):
    slug: str | None = None


class BlogPostUpdate(BlogPostBase):
    title: str | None = None
    content: str | None = None
    published: bool | None = None


class BlogPostResponse(BlogPostBase):
    id: str
    slug: str
    view_count: int
    read_time: int | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BlogPostListResponse(BaseModel):
    posts: list[BlogPostResponse]
    total: int
    page: int
    per_page: int
    pages: int