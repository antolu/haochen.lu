"""Initial database schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-09-16 18:51:00.000000

"""

from __future__ import annotations

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
        sa.Column("technologies", sa.Text()),
        sa.Column("featured", sa.Boolean(), default=False),
        sa.Column("status", sa.String(50), default="active"),
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

    # Create indexes
    op.create_index("ix_photos_location", "photos", ["location_lat", "location_lon"])
    op.create_index("ix_photos_date_taken", "photos", ["date_taken"])
    op.create_index("ix_photos_featured", "photos", ["featured"])
    op.create_index("ix_photos_order", "photos", ["order"])
    op.create_index("ix_projects_featured", "projects", ["featured"])
    op.create_index("ix_blog_posts_published", "blog_posts", ["published"])
    op.create_index("ix_blog_posts_published_at", "blog_posts", ["published_at"])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_index("ix_blog_posts_published_at", table_name="blog_posts")
    op.drop_index("ix_blog_posts_published", table_name="blog_posts")
    op.drop_index("ix_projects_featured", table_name="projects")
    op.drop_index("ix_photos_order", table_name="photos")
    op.drop_index("ix_photos_featured", table_name="photos")
    op.drop_index("ix_photos_date_taken", table_name="photos")
    op.drop_index("ix_photos_location", table_name="photos")

    op.drop_table("subapps")
    op.drop_table("blog_posts")
    op.drop_table("projects")
    op.drop_table("photos")
    op.drop_table("users")
