"""Fix project_images schema - add missing columns

Revision ID: 008_fix_project_images_schema
Revises: 007_add_project_images
Create Date: 2025-09-26 08:16:42.758506

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "008_fix_project_images_schema"
down_revision = "007_add_project_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing columns for direct file storage
    op.add_column(
        "project_images", sa.Column("filename", sa.String(255), nullable=True)
    )
    op.add_column(
        "project_images", sa.Column("original_path", sa.String(500), nullable=True)
    )
    op.add_column("project_images", sa.Column("variants", sa.JSON(), nullable=True))

    # Make photo_id nullable as it should be optional for direct uploads
    op.alter_column("project_images", "photo_id", nullable=True)


def downgrade() -> None:
    # Remove added columns
    op.drop_column("project_images", "variants")
    op.drop_column("project_images", "original_path")
    op.drop_column("project_images", "filename")

    # Revert photo_id to not nullable (note: this may fail if there are null values)
    op.alter_column("project_images", "photo_id", nullable=False)
