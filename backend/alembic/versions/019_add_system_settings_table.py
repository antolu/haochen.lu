"""add system settings table

Revision ID: 019_add_system_settings_table
Revises: 018_add_files_table
Create Date: 2026-06-10 19:22:16.841446

"""

from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "019_add_system_settings_table"
down_revision = "018_add_files_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create the table
    system_settings_table = op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "responsive_sizes", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column(
            "quality_settings", postgresql.JSONB(astext_type=sa.Text()), nullable=False
        ),
        sa.Column("avif_quality_base_offset", sa.Integer(), nullable=False),
        sa.Column("avif_quality_floor", sa.Integer(), nullable=False),
        sa.Column("avif_effort_default", sa.Integer(), nullable=False),
        sa.Column("webp_quality", sa.Integer(), nullable=False),
        sa.Column("rate_limit_enabled", sa.Boolean(), nullable=False),
        sa.Column("rate_limit_calls", sa.Integer(), nullable=False),
        sa.Column("rate_limit_period", sa.Integer(), nullable=False),
        sa.Column("rate_limit_file_calls", sa.Integer(), nullable=False),
        sa.Column("rate_limit_file_period", sa.Integer(), nullable=False),
        sa.Column("rate_limit_auth_calls", sa.Integer(), nullable=False),
        sa.Column("rate_limit_auth_period", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the initial row
    op.bulk_insert(
        system_settings_table,
        [
            {
                "id": 1,
                "responsive_sizes": {
                    "micro": 200,
                    "thumbnail": 400,
                    "small": 800,
                    "medium": 1200,
                    "large": 1600,
                    "xlarge": 2400,
                },
                "quality_settings": {
                    "micro": 70,
                    "thumbnail": 75,
                    "small": 80,
                    "medium": 85,
                    "large": 90,
                    "xlarge": 95,
                },
                "avif_quality_base_offset": -10,
                "avif_quality_floor": 50,
                "avif_effort_default": 6,
                "webp_quality": 85,
                "rate_limit_enabled": True,
                "rate_limit_calls": 100,
                "rate_limit_period": 3600,
                "rate_limit_file_calls": 20,
                "rate_limit_file_period": 60,
                "rate_limit_auth_calls": 60,
                "rate_limit_auth_period": 60,
                "updated_at": datetime.utcnow(),
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("system_settings")
