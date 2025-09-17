# Auth schemas
from app.schemas.auth import (
    LoginRequest as LoginRequest,
)
from app.schemas.auth import (
    TokenResponse as TokenResponse,
)
from app.schemas.auth import (
    UserResponse,
)

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

# Legacy aliases for backward compatibility
User = UserResponse
Content = ContentResponse
ContentKeyValue = ContentKeyValueResponse
SubApp = SubAppResponse
