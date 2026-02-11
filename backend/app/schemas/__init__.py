from __future__ import annotations

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

# SubApp schemas
from app.schemas.subapp import (
    SubAppCreate,
    SubAppListResponse,
    SubAppResponse,
    SubAppUpdate,
)

# User schemas (fastapi-users)
from app.schemas.user import UserCreate, UserRead, UserUpdate

__all__ = [
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
    # SubApp
    "SubAppCreate",
    "SubAppListResponse",
    "SubAppResponse",
    "SubAppUpdate",
    # User
    "UserCreate",
    "UserRead",
    "UserUpdate",
]
