"""
Integration test data seeding script.

Creates a predictable set of test data for integration tests.
This runs once at container startup to populate the test database.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from sqlalchemy import select
from tests.factories import BlogPostFactory, PhotoFactory, ProjectFactory, UserFactory

from app.database import get_session
from app.models.blog import BlogPost
from app.models.photo import Photo
from app.models.project import Project
from app.models.user import User


async def seed_integration_data():
    """Seed test database with predictable data for integration tests."""
    print("Starting integration test data seeding...", flush=True)

    async for session in get_session():
        # Create admin user
        result = await session.execute(
            select(User).where(User.username == "integration_admin")
        )
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            print("Creating integration admin user...", flush=True)
            admin_user = await UserFactory.create_async(
                session,
                username="integration_admin",
                email="admin@integration.test",
                is_admin=True,
                is_superuser=True,
                is_active=True,
            )
        else:
            print("Admin user already exists", flush=True)

        # Create regular user
        result = await session.execute(
            select(User).where(User.username == "integration_user")
        )
        regular_user = result.scalar_one_or_none()

        if not regular_user:
            print("Creating integration regular user...", flush=True)
            regular_user = await UserFactory.create_async(
                session,
                username="integration_user",
                email="user@integration.test",
                is_admin=False,
                is_superuser=False,
                is_active=True,
            )
        else:
            print("Regular user already exists", flush=True)

        # Count existing photos
        result = await session.execute(select(Photo))
        existing_count = len(result.scalars().all())

        # Create test photos if needed
        if existing_count < 10:
            print(f"Creating {10 - existing_count} test photos...", flush=True)

            # Public photos
            await PhotoFactory.create_async(
                session,
                title="San Francisco Bay",
                description="Beautiful view of San Francisco Bay at sunset",
                category="landscape",
                tags="landscape, sunset, bay",
                access_level="public",
                featured=True,
                location_lat=37.7749,
                location_lon=-122.4194,
                location_name="San Francisco, California, United States",
            )

            await PhotoFactory.create_async(
                session,
                title="Golden Gate Bridge",
                description="Iconic Golden Gate Bridge",
                category="landmark",
                tags="bridge, landmark, architecture",
                access_level="public",
                featured=False,
                location_lat=37.8199,
                location_lon=-122.4783,
                location_name="Golden Gate Bridge, San Francisco, CA",
            )

            await PhotoFactory.create_async(
                session,
                title="Mountain Landscape",
                description="Majestic mountain landscape",
                category="landscape",
                tags="mountain, nature, landscape",
                access_level="public",
                featured=False,
            )

            await PhotoFactory.create_async(
                session,
                title="City Street",
                description="Urban street photography",
                category="street",
                tags="urban, street, city",
                access_level="public",
                featured=False,
            )

            await PhotoFactory.create_async(
                session,
                title="Beach Sunset",
                description="Sunset at the beach",
                category="landscape",
                tags="beach, sunset, ocean",
                access_level="public",
                featured=False,
            )

            # Private photos
            await PhotoFactory.create_async(
                session,
                title="Private Event",
                description="Private event photo",
                category="event",
                tags="private, event",
                access_level="private",
                featured=False,
            )

            # Unlisted photo - use authenticated instead since unlisted doesn't exist
            await PhotoFactory.create_async(
                session,
                title="Authenticated Photo",
                description="Photo visible only to authenticated users",
                category="test",
                tags="authenticated, test",
                access_level="authenticated",
                featured=False,
            )
        else:
            print(f"Photos already exist ({existing_count} found)", flush=True)

        # Create test projects
        result = await session.execute(select(Project))
        project_count = len(result.scalars().all())

        if project_count < 3:
            print(f"Creating {3 - project_count} test projects...", flush=True)

            await ProjectFactory.create_async(
                session,
                title="Portfolio Website",
                slug="portfolio-website",
                description="Personal portfolio website built with FastAPI and React",
                status="completed",
                github_url="https://github.com/test/portfolio",
            )

            await ProjectFactory.create_async(
                session,
                title="Photography App",
                slug="photography-app",
                description="Mobile app for photographers",
                status="in_progress",
                github_url="https://github.com/test/photo-app",
            )

            await ProjectFactory.create_async(
                session,
                title="Image Processor",
                slug="image-processor",
                description="High-performance image processing library",
                status="completed",
                github_url="https://github.com/test/image-processor",
            )
        else:
            print(f"Projects already exist ({project_count} found)", flush=True)

        # Create test blog posts
        result = await session.execute(select(BlogPost))
        blog_count = len(result.scalars().all())

        if blog_count < 3:
            print(f"Creating {3 - blog_count} test blog posts...", flush=True)

            await BlogPostFactory.create_async(
                session,
                title="Getting Started with FastAPI",
                slug="getting-started-fastapi",
                content="Learn how to build modern APIs with FastAPI...",
                published=True,
                tags="fastapi, python, tutorial",
            )

            await BlogPostFactory.create_async(
                session,
                title="Photography Tips",
                slug="photography-tips",
                content="Essential tips for better photography...",
                published=True,
                tags="photography, tips",
            )

            await BlogPostFactory.create_async(
                session,
                title="Draft Post",
                slug="draft-post",
                content="This is a draft post...",
                published=False,
                tags="draft",
            )
        else:
            print(f"Blog posts already exist ({blog_count} found)", flush=True)

        await session.commit()
        print("Integration test data seeding completed successfully!", flush=True)
        break


if __name__ == "__main__":
    asyncio.run(seed_integration_data())
