"""add camera and lens alias tables

Revision ID: 003_add_camera_and_lens_alias_tables
Revises: 002_add_access_level_to_photos
Create Date: 2025-09-21 01:31:24.516317

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = "003_add_alias_tables"
down_revision = "002_add_access_level_to_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create camera_aliases table
    op.create_table(
        "camera_aliases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("original_name", sa.String(200), nullable=False, index=True),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("brand", sa.String(100)),
        sa.Column("model", sa.String(100)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create indexes for camera_aliases
    op.create_index(
        "ix_camera_aliases_original_name_active",
        "camera_aliases",
        ["original_name", "is_active"],
    )
    op.create_index(
        "ix_camera_aliases_brand_model", "camera_aliases", ["brand", "model"]
    )

    # Create lens_aliases table
    op.create_table(
        "lens_aliases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("original_name", sa.String(300), nullable=False, index=True),
        sa.Column("display_name", sa.String(300), nullable=False),
        sa.Column("brand", sa.String(100)),
        sa.Column("model", sa.String(200)),
        sa.Column("mount_type", sa.String(50)),
        sa.Column("focal_length", sa.String(100)),
        sa.Column("max_aperture", sa.String(50)),
        sa.Column("lens_type", sa.String(50)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create indexes for lens_aliases
    op.create_index(
        "ix_lens_aliases_original_name_active",
        "lens_aliases",
        ["original_name", "is_active"],
    )
    op.create_index(
        "ix_lens_aliases_brand_mount", "lens_aliases", ["brand", "mount_type"]
    )
    op.create_index("ix_lens_aliases_focal_length", "lens_aliases", ["focal_length"])


def downgrade() -> None:
    # Drop indexes first
    op.drop_index("ix_lens_aliases_focal_length", "lens_aliases")
    op.drop_index("ix_lens_aliases_brand_mount", "lens_aliases")
    op.drop_index("ix_lens_aliases_original_name_active", "lens_aliases")
    op.drop_index("ix_camera_aliases_brand_model", "camera_aliases")
    op.drop_index("ix_camera_aliases_original_name_active", "camera_aliases")

    # Drop tables
    op.drop_table("lens_aliases")
    op.drop_table("camera_aliases")
