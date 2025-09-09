from __future__ import annotations

from uuid import UUID
from datetime import datetime
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.blog import BlogPost
from app.schemas.blog import BlogPostCreate, BlogPostUpdate


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title."""
    return title.lower().replace(" ", "-").replace(".", "").replace(",", "")


async def get_blog_posts(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 20,
    published_only: bool = True
) -> list[BlogPost]:
    query = select(BlogPost)
    
    if published_only:
        query = query.where(BlogPost.published == True)
    
    query = query.order_by(desc(BlogPost.published_at), desc(BlogPost.created_at))
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_blog_post_count(db: AsyncSession, published_only: bool = True) -> int:
    query = select(func.count(BlogPost.id))
    
    if published_only:
        query = query.where(BlogPost.published == True)
    
    result = await db.execute(query)
    return result.scalar()


async def get_blog_post(db: AsyncSession, post_id: UUID) -> BlogPost | None:
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    return result.scalar_one_or_none()


async def get_blog_post_by_slug(db: AsyncSession, slug: str) -> BlogPost | None:
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    return result.scalar_one_or_none()


async def create_blog_post(db: AsyncSession, post: BlogPostCreate) -> BlogPost:
    slug = post.slug or generate_slug(post.title)
    
    # Ensure unique slug
    counter = 1
    original_slug = slug
    while await get_blog_post_by_slug(db, slug):
        slug = f"{original_slug}-{counter}"
        counter += 1
    
    post_data = post.model_dump()
    post_data["slug"] = slug
    
    # Set published_at if publishing
    if post.published and not post_data.get("published_at"):
        post_data["published_at"] = datetime.utcnow()
    
    # Calculate read time (rough estimate: 200 words per minute)
    word_count = len(post.content.split())
    post_data["read_time"] = max(1, word_count // 200)
    
    db_post = BlogPost(**post_data)
    db.add(db_post)
    await db.commit()
    await db.refresh(db_post)
    return db_post


async def update_blog_post(db: AsyncSession, post_id: UUID, post: BlogPostUpdate) -> BlogPost | None:
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    db_post = result.scalar_one_or_none()
    
    if db_post:
        update_data = post.model_dump(exclude_unset=True)
        
        # Update published_at when publishing
        if update_data.get("published") and not db_post.published:
            update_data["published_at"] = datetime.utcnow()
        
        # Update read time if content changed
        if "content" in update_data:
            word_count = len(update_data["content"].split())
            update_data["read_time"] = max(1, word_count // 200)
        
        for field, value in update_data.items():
            setattr(db_post, field, value)
        
        await db.commit()
        await db.refresh(db_post)
    
    return db_post


async def delete_blog_post(db: AsyncSession, post_id: UUID) -> bool:
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    db_post = result.scalar_one_or_none()
    
    if db_post:
        await db.delete(db_post)
        await db.commit()
        return True
    
    return False


async def increment_view_count(db: AsyncSession, post_id: UUID) -> None:
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    db_post = result.scalar_one_or_none()
    
    if db_post:
        db_post.view_count += 1
        await db.commit()