"""enhance_photo_metadata_with_timezone_and_flexible_fields

Revision ID: 002_enhance_photo_metadata
Revises:
Create Date: 2025-09-16 12:26:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "002_enhance_photo_metadata"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add enhanced metadata fields to photos table."""
    # Add new location and metadata fields
    op.add_column("photos", sa.Column("location_address", sa.Text(), nullable=True))
    op.add_column("photos", sa.Column("altitude", sa.Float(), nullable=True))
    op.add_column("photos", sa.Column("timezone", sa.String(length=50), nullable=True))
    op.add_column("photos", sa.Column("metadata", sa.JSON(), nullable=True))

    # Create indexes for location-based queries
    op.create_index("ix_photos_location", "photos", ["location_lat", "location_lon"])
    op.create_index("ix_photos_date_taken", "photos", ["date_taken"])


def downgrade() -> None:
    """Remove enhanced metadata fields from photos table."""
    # Drop indexes
    op.drop_index("ix_photos_date_taken", table_name="photos")
    op.drop_index("ix_photos_location", table_name="photos")

    # Remove added columns
    op.drop_column("photos", "metadata")
    op.drop_column("photos", "timezone")
    op.drop_column("photos", "altitude")
    op.drop_column("photos", "location_address")
