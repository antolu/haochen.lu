from __future__ import annotations

# Application CRUD
from app.crud.application import (
    create_application,
    delete_application,
    get_application,
    get_application_by_slug,
    get_applications,
    update_application,
)

# Blog CRUD
from app.crud.blog import (
    create_blog_post,
    delete_blog_post,
    get_blog_post,
    get_blog_post_by_slug,
    get_blog_posts,
    update_blog_post,
)
from app.crud.blog import (
    increment_view_count as increment_blog_view_count,
)

# Content CRUD
from app.crud.content import (
    create_content,
    delete_content,
    get_content_by_id,
    get_content_by_key,
    get_content_list,
    update_content,
)

# Photo CRUD
from app.crud.photo import (
    bulk_reorder_photos,
    create_photo,
    delete_photo,
    get_photo,
    get_photos,
    update_photo,
)
from app.crud.photo import (
    increment_view_count as increment_photo_view_count,
)

# Project CRUD
from app.crud.project import (
    create_project,
    delete_project,
    get_project,
    get_project_by_slug,
    get_projects,
    update_project,
)

# User CRUD
from app.crud.user import (
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
)

__all__ = [
    # Photo
    "bulk_reorder_photos",
    # Application
    "create_application",
    # Blog
    "create_blog_post",
    # Content
    "create_content",
    "create_photo",
    # Project
    "create_project",
    "delete_application",
    "delete_blog_post",
    "delete_content",
    "delete_photo",
    "delete_project",
    "get_application",
    "get_application_by_slug",
    "get_applications",
    "get_blog_post",
    "get_blog_post_by_slug",
    "get_blog_posts",
    "get_content_by_id",
    "get_content_by_key",
    "get_content_list",
    "get_photo",
    "get_photos",
    "get_project",
    "get_project_by_slug",
    "get_projects",
    # User
    "get_user_by_email",
    "get_user_by_id",
    "get_user_by_username",
    "increment_blog_view_count",
    "increment_photo_view_count",
    "update_application",
    "update_blog_post",
    "update_content",
    "update_photo",
    "update_project",
]
