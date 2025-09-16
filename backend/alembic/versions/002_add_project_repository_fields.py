"""Add repository integration fields to projects table

Revision ID: 002_add_project_repository_fields
Revises: 001_initial_schema
Create Date: 2025-09-16 19:15:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

# revision identifiers
revision = "002_add_project_repository_fields"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add repository integration fields to projects table."""

    # Add repository integration columns
    op.add_column("projects", sa.Column("repository_type", sa.String(20)))
    op.add_column("projects", sa.Column("repository_owner", sa.String(100)))
    op.add_column("projects", sa.Column("repository_name", sa.String(100)))
    op.add_column("projects", sa.Column("use_readme", sa.Boolean(), default=False))
    op.add_column("projects", sa.Column("readme_content", sa.Text()))
    op.add_column("projects", sa.Column("readme_last_updated", sa.DateTime()))

    # Update technologies column to be Text instead of String(500)
    op.alter_column("projects", "technologies", type_=sa.Text())


def downgrade() -> None:
    """Remove repository integration fields from projects table."""

    # Remove added columns
    op.drop_column("projects", "readme_last_updated")
    op.drop_column("projects", "readme_content")
    op.drop_column("projects", "use_readme")
    op.drop_column("projects", "repository_name")
    op.drop_column("projects", "repository_owner")
    op.drop_column("projects", "repository_type")

    # Revert technologies column back to String(500)
    op.alter_column("projects", "technologies", type_=sa.String(500))
