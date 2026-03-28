from __future__ import annotations

# Application schemas
from app.schemas.application import (
    ApplicationCreate,
    ApplicationListResponse,
    ApplicationResponse,
    ApplicationUpdate,
)

# Blog schemas
from app.schemas.blog import (
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostResponse,
    BlogPostUpdate,
)

# Content schemas
from app.schemas.content import (
    ContentCreate,
    ContentKeyValueResponse,
    ContentListResponse,
    ContentResponse,
    ContentUpdate,
)

# Hero image schemas
from app.schemas.hero_image import (
    HeroImageActivate,
    HeroImageCreate,
    HeroImageFocalPointUpdate,
    HeroImageResponse,
    HeroImageUpdate,
)

# Photo schemas
from app.schemas.photo import (
    ImageVariant,
    PhotoCreate,
    PhotoListResponse,
    PhotoReorderItem,
    PhotoReorderRequest,
    PhotoResponse,
    PhotoUpdate,
)

# Project schemas
from app.schemas.project import (
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
    ReadmeResponse,
)

# User schemas (fastapi-users)
from app.schemas.user import UserCreate, UserRead, UserUpdate

__all__ = [
    # Application
    "ApplicationCreate",
    "ApplicationListResponse",
    "ApplicationResponse",
    "ApplicationUpdate",
    # Blog
    "BlogPostCreate",
    "BlogPostListResponse",
    "BlogPostResponse",
    "BlogPostUpdate",
    # Content
    "ContentCreate",
    "ContentKeyValueResponse",
    "ContentListResponse",
    "ContentResponse",
    "ContentUpdate",
    # Hero Image
    "HeroImageActivate",
    "HeroImageCreate",
    "HeroImageFocalPointUpdate",
    "HeroImageResponse",
    "HeroImageUpdate",
    # Photo
    "ImageVariant",
    "PhotoCreate",
    "PhotoListResponse",
    "PhotoReorderItem",
    "PhotoReorderRequest",
    "PhotoResponse",
    "PhotoUpdate",
    # Project
    "ProjectCreate",
    "ProjectListResponse",
    "ProjectResponse",
    "ProjectUpdate",
    "ReadmeResponse",
    # User
    "UserCreate",
    "UserRead",
    "UserUpdate",
]
