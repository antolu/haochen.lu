"""Content schemas for API validation."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ContentBase(BaseModel):
    """Base content schema."""

    key: str = Field(..., max_length=100, description="Unique key for the content")
    title: str = Field(..., max_length=200, description="Human-readable title")
    content: str = Field(..., description="The actual content text")
    content_type: str = Field(
        default="text",
        max_length=50,
        description="Type of content (text, html, markdown)",
    )
    category: str = Field(
        default="general", max_length=50, description="Content category"
    )
    is_active: bool = Field(default=True, description="Whether the content is active")


class ContentCreate(ContentBase):
    """Schema for creating content."""

    pass


class ContentUpdate(BaseModel):
    """Schema for updating content."""

    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = None
    content_type: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class ContentResponse(ContentBase):
    """Schema for content response."""

    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContentListResponse(BaseModel):
    """Schema for paginated content list response."""

    content: list[ContentResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ContentKeyValueResponse(BaseModel):
    """Schema for key-value content response."""

    key: str
    content: str
    title: str
    content_type: str
