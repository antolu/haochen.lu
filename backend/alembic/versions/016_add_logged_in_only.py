"""add logged_in_only to subapps

Revision ID: 016_add_logged_in_only
Revises: 015_remove_show_in_menu
Create Date: 2026-03-29

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "016_add_logged_in_only"
down_revision = "015_remove_show_in_menu"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subapps",
        sa.Column(
            "logged_in_only",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("subapps", "logged_in_only")
