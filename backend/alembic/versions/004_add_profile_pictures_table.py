"""Add profile pictures table

Revision ID: 004_add_profile_pictures_table
Revises: 003_add_alias_tables
Create Date: 2025-09-22 21:38:20.120181

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "004_add_profile_pictures_table"
down_revision = "003_add_alias_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create profile_pictures table
    op.create_table(
        "profile_pictures",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(200), nullable=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_path", sa.String(500), nullable=False),
        sa.Column("variants", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, default=False),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # Create index for active profile picture
    op.create_index("ix_profile_pictures_is_active", "profile_pictures", ["is_active"])


def downgrade() -> None:
    # Drop the index
    op.drop_index("ix_profile_pictures_is_active", table_name="profile_pictures")

    # Drop the table
    op.drop_table("profile_pictures")
