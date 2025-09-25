"""Add hero_images table for hero image management

Revision ID: 005_add_hero_images_table
Revises: 004_add_profile_pictures_table
Create Date: 2025-09-24 12:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

from alembic import op

# revision identifiers
revision = "005_add_hero_images_table"
down_revision = "004_add_profile_pictures_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add hero_images table."""

    op.create_table(
        "hero_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("photo_id", UUID(as_uuid=True), nullable=False),
        sa.Column("focal_point_x", sa.Float, nullable=False, default=50.0),
        sa.Column("focal_point_y", sa.Float, nullable=False, default=50.0),
        sa.Column("focal_points_responsive", JSON, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, default=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )

    # Create foreign key constraint to photos table
    op.create_foreign_key(
        "fk_hero_images_photo_id",
        "hero_images",
        "photos",
        ["photo_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Create unique constraint to ensure only one active hero image
    op.create_index(
        "idx_hero_images_active_unique",
        "hero_images",
        ["is_active"],
        unique=True,
        postgresql_where=sa.text("is_active = true"),
    )

    # Create index for photo_id lookups
    op.create_index("idx_hero_images_photo_id", "hero_images", ["photo_id"])


def downgrade() -> None:
    """Drop hero_images table."""

    op.drop_table("hero_images")
