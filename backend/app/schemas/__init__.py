# User schemas (fastapi-users)
# Blog schemas
from app.schemas.blog import (
    BlogPostCreate as BlogPostCreate,
)
from app.schemas.blog import (
    BlogPostListResponse as BlogPostListResponse,
)
from app.schemas.blog import (
    BlogPostResponse as BlogPostResponse,
)
from app.schemas.blog import (
    BlogPostUpdate as BlogPostUpdate,
)

# Content schemas
from app.schemas.content import (
    ContentCreate as ContentCreate,
)
from app.schemas.content import (
    ContentKeyValueResponse,
    ContentResponse,
)
from app.schemas.content import (
    ContentListResponse as ContentListResponse,
)
from app.schemas.content import (
    ContentUpdate as ContentUpdate,
)

# Hero image schemas
from app.schemas.hero_image import (
    HeroImageActivate as HeroImageActivate,
)
from app.schemas.hero_image import (
    HeroImageCreate as HeroImageCreate,
)
from app.schemas.hero_image import (
    HeroImageFocalPointUpdate as HeroImageFocalPointUpdate,
)
from app.schemas.hero_image import (
    HeroImageResponse as HeroImageResponse,
)
from app.schemas.hero_image import (
    HeroImageUpdate as HeroImageUpdate,
)

# Photo schemas
from app.schemas.photo import (
    ImageVariant as ImageVariant,
)
from app.schemas.photo import (
    PhotoCreate as PhotoCreate,
)
from app.schemas.photo import (
    PhotoListResponse as PhotoListResponse,
)
from app.schemas.photo import (
    PhotoReorderItem as PhotoReorderItem,
)
from app.schemas.photo import (
    PhotoReorderRequest as PhotoReorderRequest,
)
from app.schemas.photo import (
    PhotoResponse as PhotoResponse,
)
from app.schemas.photo import (
    PhotoUpdate as PhotoUpdate,
)

# Project schemas
from app.schemas.project import (
    ProjectCreate as ProjectCreate,
)
from app.schemas.project import (
    ProjectListResponse as ProjectListResponse,
)
from app.schemas.project import (
    ProjectResponse as ProjectResponse,
)
from app.schemas.project import (
    ProjectUpdate as ProjectUpdate,
)
from app.schemas.project import (
    ReadmeResponse as ReadmeResponse,
)

# SubApp schemas
from app.schemas.subapp import (
    SubAppCreate as SubAppCreate,
)
from app.schemas.subapp import (
    SubAppListResponse as SubAppListResponse,
)
from app.schemas.subapp import (
    SubAppResponse,
)
from app.schemas.subapp import (
    SubAppUpdate as SubAppUpdate,
)
from app.schemas.user import (
    UserCreate as UserCreate,
)
from app.schemas.user import (
    UserRead as UserRead,
)
from app.schemas.user import (
    UserUpdate as UserUpdate,
)

# Legacy aliases for backward compatibility
User = UserRead  # Changed from UserResponse
UserResponse = UserRead  # Alias for backward compatibility
Content = ContentResponse
ContentKeyValue = ContentKeyValueResponse
SubApp = SubAppResponse
