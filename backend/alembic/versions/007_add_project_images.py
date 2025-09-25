"""Add project_images table to attach multiple images to projects

Revision ID: 007_add_project_images
Revises: 006_add_order_to_projects
Create Date: 2025-09-25 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic.
revision = "007_add_project_images"
down_revision = "006_add_order_to_projects"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_images",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", UUID(as_uuid=True), nullable=False),
        sa.Column("photo_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(200)),
        sa.Column("alt_text", sa.String(300)),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
    )

    # FKs and indexes
    op.create_foreign_key(
        "fk_project_images_project_id",
        "project_images",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_project_images_photo_id",
        "project_images",
        "photos",
        ["photo_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "idx_project_images_project_order",
        "project_images",
        ["project_id", "order"],
    )

    # Remove server default after backfilling existing rows (none expected)
    op.alter_column("project_images", "order", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_project_images_project_order", table_name="project_images")
    op.drop_table("project_images")
