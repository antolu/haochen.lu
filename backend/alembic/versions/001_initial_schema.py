"""Complete initial database schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-09-16 21:30:00.000000

"""

from __future__ import annotations

from uuid import uuid4

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

from alembic import op

# revision identifiers
revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial database schema."""

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(50), nullable=False, unique=True),
        sa.Column("email", sa.String(255), unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("is_admin", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create photos table
    op.create_table(
        "photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("category", sa.String(50)),
        sa.Column("tags", sa.String(500)),
        sa.Column("comments", sa.Text()),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_path", sa.String(500), nullable=False),
        sa.Column("variants", JSON(), nullable=False),
        sa.Column("location_lat", sa.Float()),
        sa.Column("location_lon", sa.Float()),
        sa.Column("location_name", sa.String(200)),
        sa.Column("location_address", sa.Text()),
        sa.Column("altitude", sa.Float()),
        sa.Column("timezone", sa.String(50)),
        sa.Column("camera_make", sa.String(100)),
        sa.Column("camera_model", sa.String(100)),
        sa.Column("lens", sa.String(100)),
        sa.Column("iso", sa.Integer()),
        sa.Column("aperture", sa.Float()),
        sa.Column("shutter_speed", sa.String(50)),
        sa.Column("focal_length", sa.Integer()),
        sa.Column("date_taken", sa.DateTime()),
        sa.Column("custom_metadata", JSON()),
        sa.Column("file_size", sa.Integer()),
        sa.Column("width", sa.Integer()),
        sa.Column("height", sa.Integer()),
        sa.Column("featured", sa.Boolean(), default=False),
        sa.Column("order", sa.Integer(), default=0),
        sa.Column("view_count", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create projects table
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("short_description", sa.String(500)),
        # URLs
        sa.Column("github_url", sa.String(500)),
        sa.Column("demo_url", sa.String(500)),
        sa.Column("image_url", sa.String(500)),
        # Repository Integration
        sa.Column("repository_type", sa.String(20)),
        sa.Column("repository_owner", sa.String(100)),
        sa.Column("repository_name", sa.String(100)),
        sa.Column("use_readme", sa.Boolean(), default=False),
        sa.Column("readme_content", sa.Text()),
        sa.Column("readme_last_updated", sa.DateTime()),
        # Technologies (JSON string)
        sa.Column("technologies", sa.Text()),
        # Status
        sa.Column("featured", sa.Boolean(), default=False),
        sa.Column("status", sa.String(50), default="active"),
        # Timestamps
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create blog_posts table
    op.create_table(
        "blog_posts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("excerpt", sa.Text()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("published", sa.Boolean(), default=False),
        sa.Column("published_at", sa.DateTime()),
        sa.Column("meta_description", sa.String(160)),
        sa.Column("featured_image", sa.String(500)),
        sa.Column("tags", sa.String(500)),
        sa.Column("category", sa.String(100)),
        sa.Column("view_count", sa.Integer(), default=0),
        sa.Column("read_time", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create subapps table
    op.create_table(
        "subapps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text()),
        sa.Column("icon", sa.String(100)),
        sa.Column("color", sa.String(20)),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("is_external", sa.Boolean(), default=False),
        sa.Column("requires_auth", sa.Boolean(), default=False),
        sa.Column("admin_only", sa.Boolean(), default=False),
        sa.Column("show_in_menu", sa.Boolean(), default=True),
        sa.Column("enabled", sa.Boolean(), default=True),
        sa.Column("order", sa.Integer(), default=0),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create content table for editable website content
    content_table = op.create_table(
        "content",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("content_type", sa.String(50), nullable=False, default="text"),
        sa.Column("category", sa.String(50), nullable=False, default="general"),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )

    # Create indexes
    op.create_index("ix_photos_location", "photos", ["location_lat", "location_lon"])
    op.create_index("ix_photos_date_taken", "photos", ["date_taken"])
    op.create_index("ix_photos_featured", "photos", ["featured"])
    op.create_index("ix_photos_order", "photos", ["order"])
    op.create_index("ix_projects_featured", "projects", ["featured"])
    op.create_index("ix_blog_posts_published", "blog_posts", ["published"])
    op.create_index("ix_blog_posts_published_at", "blog_posts", ["published_at"])

    # Content table indexes with explicit naming to avoid conflicts
    op.create_index("idx_content_category", "content", ["category"])
    op.create_index("idx_content_is_active", "content", ["is_active"])

    # Content table unique constraint with explicit naming
    op.create_unique_constraint("uq_content_key_value", "content", ["key"])

    # Insert initial content data
    initial_content = [
        {
            "id": uuid4(),
            "key": "hero.tagline",
            "title": "Hero Tagline",
            "content": "Student. Traveler. Photographer.",
            "content_type": "text",
            "category": "hero",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "hero.subtitle",
            "title": "Hero Subtitle",
            "content": "Machine Learning at KTH Stockholm",
            "content_type": "text",
            "category": "hero",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "about.title",
            "title": "About Section Title",
            "content": "About Me",
            "content_type": "text",
            "category": "about",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "about.description",
            "title": "About Section Description",
            "content": "My name is Anton (Hào-chen) Lu, and I'm a M.Sc. student at KTH Royal Institute of Technology in Stockholm, Sweden. I'm currently enrolled in a five-year degree programme in Engineering Physics, pursuing a M.Sc. in Machine Learning with specialization in deep learning and computational linguistics. My biggest passion is learning new things, whether it be a new problem solving method, a new programming language, a new spoken language, or how to capture the perfect moment through photography.",
            "content_type": "text",
            "category": "about",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "photography.title",
            "title": "Photography Section Title",
            "content": "Latest Photography",
            "content_type": "text",
            "category": "photography",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "projects.title",
            "title": "Projects Section Title",
            "content": "Latest Projects",
            "content_type": "text",
            "category": "projects",
            "is_active": True,
        },
        {
            "id": uuid4(),
            "key": "contact.title",
            "title": "Contact Section Title",
            "content": "Get In Touch",
            "content_type": "text",
            "category": "contact",
            "is_active": True,
        },
    ]

    # Insert the initial content
    op.bulk_insert(content_table, initial_content)


def downgrade() -> None:
    """Drop all tables."""
    # Drop content constraints and indexes
    op.drop_constraint("uq_content_key_value", "content", type_="unique")
    op.drop_index("idx_content_is_active", table_name="content")
    op.drop_index("idx_content_category", table_name="content")

    # Drop indexes
    op.drop_index("ix_blog_posts_published_at", table_name="blog_posts")
    op.drop_index("ix_blog_posts_published", table_name="blog_posts")
    op.drop_index("ix_projects_featured", table_name="projects")
    op.drop_index("ix_photos_order", table_name="photos")
    op.drop_index("ix_photos_featured", table_name="photos")
    op.drop_index("ix_photos_date_taken", table_name="photos")
    op.drop_index("ix_photos_location", table_name="photos")

    # Drop tables
    op.drop_table("content")
    op.drop_table("subapps")
    op.drop_table("blog_posts")
    op.drop_table("projects")
    op.drop_table("photos")
    op.drop_table("users")
