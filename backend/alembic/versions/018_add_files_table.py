from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "018_add_files_table"
down_revision = "017_rm_app_creds"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("original_name", sa.String(500), nullable=False, unique=True),
        sa.Column("stored_filename", sa.String(500), nullable=False),
        sa.Column("original_path", sa.String(1000), nullable=False),
        sa.Column("mime_type", sa.String(200), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column(
            "access_level",
            postgresql.ENUM(
                "public",
                "authenticated",
                "private",
                name="accesslevel",
                create_type=False,
            ),
            nullable=False,
            server_default="public",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_files_original_name", "files", ["original_name"])


def downgrade() -> None:
    op.drop_index("ix_files_original_name", table_name="files")
    op.drop_table("files")
