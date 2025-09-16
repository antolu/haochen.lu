"""Add variants column to photos table

Revision ID: 001
Revises:
Create Date: 2025-01-16 12:00:00.000000

"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add variants column to photos table
    op.add_column(
        "photos",
        sa.Column("variants", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    # Remove variants column from photos table
    op.drop_column("photos", "variants")
