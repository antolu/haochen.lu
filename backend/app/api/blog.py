from __future__ import annotations

import math
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.blog import (
    create_blog_post,
    delete_blog_post,
    get_blog_post,
    get_blog_post_by_slug,
    get_blog_post_count,
    get_blog_posts,
    increment_view_count,
    update_blog_post,
)
from app.database import get_session
from app.dependencies import get_current_admin_user
from app.schemas.blog import (
    BlogPostCreate,
    BlogPostListResponse,
    BlogPostResponse,
    BlogPostUpdate,
)

router = APIRouter()

# Module-level dependency variables to avoid B008
db_dependency = Depends(get_session)
admin_dependency = Depends(get_current_admin_user)


@router.get("", response_model=BlogPostListResponse)
async def list_blog_posts(
    page: int = 1,
    per_page: int = 10,
    *,
    published_only: bool = Query(
        default=True, description="Filter to only published posts"
    ),
    db: AsyncSession = db_dependency,
):
    """List blog posts with pagination."""
    skip = (page - 1) * per_page

    posts = await get_blog_posts(
        db, skip=skip, limit=per_page, published_only=published_only
    )

    total = await get_blog_post_count(db, published_only=published_only)
    pages = math.ceil(total / per_page)

    return BlogPostListResponse(
        posts=[BlogPostResponse.model_validate(post) for post in posts],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/admin", response_model=BlogPostListResponse)
async def list_all_blog_posts(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """List all blog posts including drafts (admin only)."""
    skip = (page - 1) * per_page

    posts = await get_blog_posts(db, skip=skip, limit=per_page, published_only=False)

    total = await get_blog_post_count(db, published_only=False)
    pages = math.ceil(total / per_page)

    return BlogPostListResponse(
        posts=[BlogPostResponse.model_validate(post) for post in posts],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/{post_identifier}", response_model=BlogPostResponse)
async def get_blog_post_detail(
    post_identifier: str,
    *,
    increment_views: bool = Query(
        default=True, description="Whether to increment view count"
    ),
    db: AsyncSession = db_dependency,
):
    """Get blog post by ID or slug."""
    post = None

    # Try to parse as UUID first
    try:
        post_id = UUID(post_identifier)
        post = await get_blog_post(db, post_id)
    except ValueError:
        # If not a valid UUID, treat as slug
        post = await get_blog_post_by_slug(db, post_identifier)

    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    # Only show published posts to non-admin users
    # For simplicity, we'll skip auth check here, but in production
    # you'd want to check if user is admin when showing unpublished posts

    if increment_views and post.published:
        # Type assertion to help mypy understand post.id is a UUID
        post_uuid: UUID = post.id  # type: ignore[assignment]
        await increment_view_count(db, post_uuid)
        await db.refresh(post)

    return BlogPostResponse.model_validate(post)


@router.post("", response_model=BlogPostResponse)
async def create_blog_post_endpoint(
    post: BlogPostCreate,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """Create a new blog post (admin only)."""
    try:
        db_post = await create_blog_post(db, post)
        return BlogPostResponse.model_validate(db_post)
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Error creating blog post: {e!s}"
        ) from e


@router.put("/{post_id}", response_model=BlogPostResponse)
async def update_blog_post_endpoint(
    post_id: UUID,
    post_update: BlogPostUpdate,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """Update blog post (admin only)."""
    post = await update_blog_post(db, post_id, post_update)
    if not post:
        raise HTTPException(status_code=404, detail="Blog post not found")

    return BlogPostResponse.model_validate(post)


@router.delete("/{post_id}")
async def delete_blog_post_endpoint(
    post_id: UUID,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """Delete blog post (admin only)."""
    success = await delete_blog_post(db, post_id)
    if not success:
        raise HTTPException(status_code=404, detail="Blog post not found")

    return {"message": "Blog post deleted successfully"}


@router.get("/stats/summary")
async def get_blog_stats(
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """Get blog statistics (admin only)."""
    total_posts = await get_blog_post_count(db, published_only=False)
    published_posts = await get_blog_post_count(db, published_only=True)

    return {
        "total_posts": total_posts,
        "published_posts": published_posts,
        "draft_posts": total_posts - published_posts,
    }
