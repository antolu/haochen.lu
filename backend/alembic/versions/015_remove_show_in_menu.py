"""remove show_in_menu from subapps

Revision ID: 015_remove_show_in_menu
Revises: 014_seed_about_me_markdown
Create Date: 2026-03-29

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "015_remove_show_in_menu"
down_revision = "014_seed_about_me_markdown"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("subapps", "show_in_menu")


def downgrade() -> None:
    op.add_column(
        "subapps",
        sa.Column("show_in_menu", sa.Boolean(), nullable=False, server_default="true"),
    )
