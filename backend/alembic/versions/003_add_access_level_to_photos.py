"""add access_level to photos

Revision ID: 003_add_access_level_to_photos
Revises: 001_initial_schema
Create Date: 2025-09-20 21:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "003_add_access_level_to_photos"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type for access levels
    access_level_enum = postgresql.ENUM(
        "public", "authenticated", "private", name="accesslevel"
    )
    access_level_enum.create(op.get_bind())

    # Add access_level column to photos table
    op.add_column(
        "photos",
        sa.Column(
            "access_level", access_level_enum, nullable=False, server_default="public"
        ),
    )


def downgrade() -> None:
    # Remove access_level column
    op.drop_column("photos", "access_level")

    # Drop enum type
    access_level_enum = postgresql.ENUM(
        "public", "authenticated", "private", name="accesslevel"
    )
    access_level_enum.drop(op.get_bind())
