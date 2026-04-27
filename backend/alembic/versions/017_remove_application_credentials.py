from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "017_remove_application_credentials"
down_revision = "016_add_logged_in_only"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_subapps_client_id", table_name="subapps", if_exists=True)
    op.drop_column("subapps", "client_id")
    op.drop_column("subapps", "client_secret")


def downgrade() -> None:
    op.add_column(
        "subapps",
        sa.Column("client_id", sa.String(100), nullable=True, unique=True),
    )
    op.add_column(
        "subapps",
        sa.Column("client_secret", sa.String(100), nullable=True),
    )
