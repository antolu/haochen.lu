"""Remove legacy webp_path and thumbnail_path columns

Revision ID: 002
Revises: 001
Create Date: 2025-01-16 15:00:00.000000

"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove legacy columns from photos table
    op.drop_column("photos", "webp_path")
    op.drop_column("photos", "thumbnail_path")

    # Make variants column not nullable
    op.alter_column("photos", "variants", nullable=False)


def downgrade() -> None:
    # Re-add legacy columns (for rollback purposes)
    op.add_column("photos", sa.Column("webp_path", sa.String(500), nullable=True))
    op.add_column("photos", sa.Column("thumbnail_path", sa.String(500), nullable=True))

    # Make variants column nullable again
    op.alter_column("photos", "variants", nullable=True)
