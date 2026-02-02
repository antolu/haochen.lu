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
    increment_view_count as increment_blog_view_count,  # noqa: F401
)

# Content CRUD
from app.crud.content import (
    create_content as create_content,
)
from app.crud.content import (
    delete_content as delete_content,
)
from app.crud.content import (
    get_content_by_id,
    get_content_list,
)
from app.crud.content import (
    get_content_by_key as get_content_by_key,
)
from app.crud.content import (
    update_content as update_content,
)

# Photo CRUD
from app.crud.photo import (
    bulk_reorder_photos as bulk_reorder_photos,
)
from app.crud.photo import (
    create_photo as create_photo,
)
from app.crud.photo import (
    delete_photo as delete_photo,
)
from app.crud.photo import (
    get_photo as get_photo,
)
from app.crud.photo import (
    get_photos as get_photos,
)
from app.crud.photo import (
    increment_view_count as increment_photo_view_count,  # noqa: F401
)
from app.crud.photo import (
    update_photo as update_photo,
)

# Project CRUD
from app.crud.project import (
    create_project as create_project,
)
from app.crud.project import (
    delete_project as delete_project,
)
from app.crud.project import (
    get_project as get_project,
)
from app.crud.project import (
    get_project_by_slug as get_project_by_slug,
)
from app.crud.project import (
    get_projects as get_projects,
)
from app.crud.project import (
    update_project as update_project,
)

# SubApp CRUD
from app.crud.subapp import (
    create_subapp as create_subapp,
)
from app.crud.subapp import (
    delete_subapp as delete_subapp,
)
from app.crud.subapp import (
    get_subapp as get_subapp,
)
from app.crud.subapp import (
    get_subapp_by_slug as get_subapp_by_slug,
)
from app.crud.subapp import (
    get_subapps as get_subapps,
)
from app.crud.subapp import (
    update_subapp as update_subapp,
)

# User CRUD
from app.crud.user import (
    get_user_by_email as get_user_by_email,
)
from app.crud.user import (
    get_user_by_id as get_user_by_id,
)
from app.crud.user import (
    get_user_by_username as get_user_by_username,
)

# Legacy aliases for backward compatibility
create_post = create_blog_post
delete_post = delete_blog_post
get_post = get_blog_post
get_post_by_slug = get_blog_post_by_slug
get_posts = get_blog_posts
update_post = update_blog_post

get_content = get_content_by_id
get_contents = get_content_list

# Note: increment_view_count is imported with aliases due to name conflicts
# between blog and photo modules. Use increment_blog_view_count or
# increment_photo_view_count for specific functionality.
