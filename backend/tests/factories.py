"""
Factory classes for creating test data.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict

import factory
from factory import Faker, LazyAttribute
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models import User, Photo, Project, BlogPost, SubApp


class AsyncSQLAlchemyModelFactory(factory.Factory):
    """Base factory for async SQLAlchemy models."""
    
    class Meta:
        abstract = True
    
    @classmethod
    async def create_async(cls, session: AsyncSession, **kwargs) -> Any:
        """Create a model instance asynchronously."""
        instance = cls.build(**kwargs)
        session.add(instance)
        await session.commit()
        await session.refresh(instance)
        return instance
    
    @classmethod
    async def create_batch_async(cls, session: AsyncSession, size: int, **kwargs) -> list[Any]:
        """Create multiple model instances asynchronously."""
        instances = []
        for _ in range(size):
            instance = await cls.create_async(session, **kwargs)
            instances.append(instance)
        return instances


class UserFactory(AsyncSQLAlchemyModelFactory):
    """Factory for User model."""
    
    class Meta:
        model = User
    
    id = factory.LazyFunction(uuid.uuid4)
    username = Faker('user_name')
    email = Faker('email')
    hashed_password = LazyAttribute(lambda obj: get_password_hash('testpassword123'))
    is_active = True
    is_admin = False
    created_at = Faker('date_time_this_year')
    updated_at = LazyAttribute(lambda obj: obj.created_at)


class PhotoFactory(AsyncSQLAlchemyModelFactory):
    """Factory for Photo model."""
    
    class Meta:
        model = Photo
    
    id = factory.LazyFunction(uuid.uuid4)
    title = Faker('sentence', nb_words=3)
    description = Faker('paragraph', nb_sentences=2)
    category = Faker('random_element', elements=('landscape', 'portrait', 'street', 'wildlife'))
    tags = Faker('words', nb=3)
    comments = Faker('paragraph', nb_sentences=1)
    
    # File paths
    filename = LazyAttribute(lambda obj: f"{obj.id}.jpg")
    original_path = LazyAttribute(lambda obj: f"uploads/{obj.filename}")
    webp_path = LazyAttribute(lambda obj: f"compressed/{obj.id}.webp")
    thumbnail_path = LazyAttribute(lambda obj: f"compressed/{obj.id}_thumb.webp")
    
    # EXIF data
    location_lat = Faker('latitude')
    location_lon = Faker('longitude')
    location_name = Faker('city')
    camera_make = Faker('random_element', elements=('Canon', 'Nikon', 'Sony', 'Fujifilm'))
    camera_model = Faker('random_element', elements=('EOS R5', 'D850', 'A7R IV', 'X-T4'))
    lens = Faker('random_element', elements=('24-70mm f/2.8', '85mm f/1.4', '16-35mm f/2.8'))
    iso = Faker('random_element', elements=(100, 200, 400, 800, 1600))
    aperture = Faker('random_element', elements=(1.4, 1.8, 2.8, 4.0, 5.6))
    shutter_speed = Faker('random_element', elements=('1/60', '1/125', '1/250', '1/500'))
    focal_length = Faker('random_int', min=16, max=200)
    date_taken = Faker('date_time_this_year')
    
    # Metadata
    file_size = Faker('random_int', min=1000000, max=10000000)  # 1-10 MB
    width = Faker('random_element', elements=(1920, 2560, 3840, 4032))
    height = Faker('random_element', elements=(1080, 1440, 2160, 3024))
    featured = False
    order = 0
    view_count = Faker('random_int', min=0, max=1000)
    
    created_at = Faker('date_time_this_year')
    updated_at = LazyAttribute(lambda obj: obj.created_at)


class ProjectFactory(AsyncSQLAlchemyModelFactory):
    """Factory for Project model."""
    
    class Meta:
        model = Project
    
    id = factory.LazyFunction(uuid.uuid4)
    title = Faker('sentence', nb_words=3)
    slug = LazyAttribute(lambda obj: obj.title.lower().replace(' ', '-').replace('.', ''))
    description = Faker('paragraph', nb_sentences=5)
    short_description = Faker('sentence', nb_words=10)
    
    github_url = LazyAttribute(lambda obj: f"https://github.com/user/{obj.slug}")
    demo_url = LazyAttribute(lambda obj: f"https://{obj.slug}.netlify.app")
    image_url = LazyAttribute(lambda obj: f"https://images.unsplash.com/photo-{obj.id}")
    
    technologies = factory.LazyFunction(
        lambda: '["React", "TypeScript", "Node.js", "PostgreSQL"]'
    )
    
    featured = False
    status = Faker('random_element', elements=('active', 'archived', 'in_progress'))
    
    created_at = Faker('date_time_this_year')
    updated_at = LazyAttribute(lambda obj: obj.created_at)


class BlogPostFactory(AsyncSQLAlchemyModelFactory):
    """Factory for BlogPost model."""
    
    class Meta:
        model = BlogPost
    
    id = factory.LazyFunction(uuid.uuid4)
    title = Faker('sentence', nb_words=5)
    slug = LazyAttribute(lambda obj: obj.title.lower().replace(' ', '-').replace('.', ''))
    excerpt = Faker('paragraph', nb_sentences=2)
    content = Faker('text', max_nb_chars=2000)
    
    published = True
    published_at = Faker('date_time_this_year')
    
    meta_description = Faker('sentence', nb_words=15)
    featured_image = LazyAttribute(lambda obj: f"https://images.unsplash.com/photo-{obj.id}")
    
    tags = Faker('words', nb=4)
    category = Faker('random_element', elements=('photography', 'technology', 'travel', 'tutorial'))
    
    view_count = Faker('random_int', min=0, max=5000)
    read_time = Faker('random_int', min=2, max=15)
    
    created_at = Faker('date_time_this_year')
    updated_at = LazyAttribute(lambda obj: obj.created_at)


class SubAppFactory(AsyncSQLAlchemyModelFactory):
    """Factory for SubApp model."""
    
    class Meta:
        model = SubApp
    
    id = factory.LazyFunction(uuid.uuid4)
    name = Faker('word')
    slug = LazyAttribute(lambda obj: obj.name.lower())
    description = Faker('sentence', nb_words=8)
    
    icon = Faker('random_element', elements=('📊', '🛠️', '📝', '🎯', '🚀'))
    color = Faker('hex_color')
    
    url = LazyAttribute(lambda obj: f"https://{obj.slug}.example.com")
    is_external = True
    
    requires_auth = True
    admin_only = False
    show_in_menu = True
    enabled = True
    order = Faker('random_int', min=0, max=100)
    
    created_at = Faker('date_time_this_year')
    updated_at = LazyAttribute(lambda obj: obj.created_at)


# Specialized factories for testing scenarios
class AdminUserFactory(UserFactory):
    """Factory for admin users."""
    username = "admin"
    is_admin = True


class FeaturedPhotoFactory(PhotoFactory):
    """Factory for featured photos."""
    featured = True
    view_count = Faker('random_int', min=1000, max=10000)


class DraftBlogPostFactory(BlogPostFactory):
    """Factory for draft blog posts."""
    published = False
    published_at = None


class ExternalSubAppFactory(SubAppFactory):
    """Factory for external sub-applications."""
    is_external = True
    requires_auth = False


class InternalSubAppFactory(SubAppFactory):
    """Factory for internal sub-applications."""
    is_external = False
    url = LazyAttribute(lambda obj: f"/internal/{obj.slug}")


# Test data sets
class TestDataSet:
    """Predefined test data sets."""
    
    @classmethod
    async def create_complete_portfolio(cls, session: AsyncSession) -> Dict[str, Any]:
        """Create a complete portfolio with all content types."""
        admin = await AdminUserFactory.create_async(session)
        
        # Create photos
        featured_photos = await FeaturedPhotoFactory.create_batch_async(session, 3)
        regular_photos = await PhotoFactory.create_batch_async(session, 10)
        
        # Create projects
        featured_projects = await ProjectFactory.create_batch_async(
            session, 2, featured=True
        )
        regular_projects = await ProjectFactory.create_batch_async(session, 5)
        
        # Create blog posts
        published_posts = await BlogPostFactory.create_batch_async(session, 8)
        draft_posts = await DraftBlogPostFactory.create_batch_async(session, 3)
        
        # Create sub-apps
        external_apps = await ExternalSubAppFactory.create_batch_async(session, 2)
        internal_apps = await InternalSubAppFactory.create_batch_async(session, 3)
        
        return {
            'admin': admin,
            'photos': {
                'featured': featured_photos,
                'regular': regular_photos
            },
            'projects': {
                'featured': featured_projects,
                'regular': regular_projects
            },
            'blog_posts': {
                'published': published_posts,
                'draft': draft_posts
            },
            'sub_apps': {
                'external': external_apps,
                'internal': internal_apps
            }
        }
    
    @classmethod
    async def create_performance_dataset(cls, session: AsyncSession, size: int = 1000) -> Dict[str, Any]:
        """Create a large dataset for performance testing."""
        photos = await PhotoFactory.create_batch_async(session, size)
        projects = await ProjectFactory.create_batch_async(session, size // 10)
        blog_posts = await BlogPostFactory.create_batch_async(session, size // 5)
        
        return {
            'photos': photos,
            'projects': projects,
            'blog_posts': blog_posts
        }


# Security test factories
class SecurityTestFactory:
    """Factories for security testing scenarios."""
    
    @staticmethod
    def malicious_photo_data() -> Dict[str, Any]:
        """Create photo data with malicious content."""
        return {
            'title': '<script>alert("XSS")</script>',
            'description': '"><img src=x onerror=alert("XSS")>',
            'category': "'; DROP TABLE photos; --",
            'tags': '<iframe src="javascript:alert(1)"></iframe>',
            'comments': 'javascript:alert("XSS")'
        }
    
    @staticmethod
    def sql_injection_payloads() -> list[str]:
        """Common SQL injection payloads."""
        return [
            "'; DROP TABLE photos; --",
            "1' OR '1'='1",
            "admin'--",
            "1; INSERT INTO users VALUES ('hacker', 'password'); --",
            "' UNION SELECT * FROM users --",
            "1' AND (SELECT * FROM (SELECT COUNT(*),CONCAT(version(),0x3a,0x3a,FLOOR(RAND(0)*2))x FROM information_schema.columns GROUP BY x)a) --",
        ]
    
    @staticmethod
    def xss_payloads() -> list[str]:
        """Common XSS payloads."""
        return [
            '<script>alert("XSS")</script>',
            '"><script>alert("XSS")</script>',
            "javascript:alert('XSS')",
            '<img src=x onerror=alert("XSS")>',
            '<iframe src="javascript:alert(1)"></iframe>',
            '<svg onload=alert("XSS")>',
            '<body onload=alert("XSS")>',
        ]