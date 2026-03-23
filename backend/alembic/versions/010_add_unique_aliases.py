"""add_unique_constraints_to_aliases

Revision ID: f0517a4cf577
Revises: 009_migrate_to_fastapi_users
Create Date: 2026-03-06 19:09:50.211826

"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "010_add_unique_aliases"
down_revision = "009_migrate_to_fastapi_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_camera_aliases_original_name", "camera_aliases", ["original_name"]
    )
    op.create_unique_constraint(
        "uq_lens_aliases_original_name", "lens_aliases", ["original_name"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_lens_aliases_original_name", "lens_aliases", type_="unique")
    op.drop_constraint(
        "uq_camera_aliases_original_name", "camera_aliases", type_="unique"
    )
