"""add subapp admin url

Revision ID: 015_add_subapp_admin_url
Revises: 014_casdoor_sso
Create Date: 2026-03-23 16:20:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "015_add_subapp_admin_url"
down_revision = "014_casdoor_sso"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subapps", sa.Column("admin_url", sa.String(length=500), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("subapps", "admin_url")
