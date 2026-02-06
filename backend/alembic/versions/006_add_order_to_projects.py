"""add order to projects

Revision ID: 006_add_order_to_projects
Revises: 005_add_hero_images_table
Create Date: 2025-09-25 21:10:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "006_add_order_to_projects"
down_revision = "005_add_hero_images_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add column with default 0 for existing rows, then drop server_default
    op.add_column(
        "projects",
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("projects", "order", server_default=None)


def downgrade() -> None:
    op.drop_column("projects", "order")
