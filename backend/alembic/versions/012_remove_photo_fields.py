"""remove redundant photo fields

Revision ID: 012_remove_redundant_photo_fields
Revises: 011_remove_section_titles
Create Date: 2026-03-08 13:40:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "012_remove_photo_fields"
down_revision = "011_remove_section_titles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop category and comments columns from photos table
    op.drop_column("photos", "category")
    op.drop_column("photos", "comments")


def downgrade() -> None:
    # Add category and comments columns back to photos table
    op.add_column("photos", sa.Column("category", sa.String(length=50), nullable=True))
    op.add_column("photos", sa.Column("comments", sa.Text(), nullable=True))
