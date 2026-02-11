from __future__ import annotations

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

# SubApp CRUD
from app.crud.subapp import (
    create_subapp,
    delete_subapp,
    get_subapp,
    get_subapp_by_slug,
    get_subapps,
    update_subapp,
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
    # Blog
    "create_blog_post",
    # Content
    "create_content",
    "create_photo",
    # Project
    "create_project",
    # SubApp
    "create_subapp",
    "delete_blog_post",
    "delete_content",
    "delete_photo",
    "delete_project",
    "delete_subapp",
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
    "get_subapp",
    "get_subapp_by_slug",
    "get_subapps",
    # User
    "get_user_by_email",
    "get_user_by_id",
    "get_user_by_username",
    "increment_blog_view_count",
    "increment_photo_view_count",
    "update_blog_post",
    "update_content",
    "update_photo",
    "update_project",
    "update_subapp",
]
