"""casdoor sso and user refactor

Revision ID: 6c0b1925a8dd
Revises: 012_remove_photo_fields
Create Date: 2026-03-23 15:01:13.886704

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "014_casdoor_sso"
down_revision = "012_remove_photo_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "subapps", sa.Column("client_id", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "subapps", sa.Column("client_secret", sa.String(length=100), nullable=True)
    )
    op.add_column("subapps", sa.Column("redirect_uris", sa.Text(), nullable=True))
    op.create_unique_constraint(None, "subapps", ["client_id"])

    op.add_column(
        "users", sa.Column("casdoor_id", sa.String(length=255), nullable=True)
    )
    op.execute(
        "UPDATE users SET casdoor_id = 'legacy-' || id::text WHERE casdoor_id IS NULL"
    )
    op.alter_column("users", "casdoor_id", nullable=False)
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.drop_constraint("users_username_key", "users", type_="unique")
    op.alter_column(
        "users", "username", existing_type=sa.String(length=50), nullable=True
    )
    op.create_index(op.f("ix_users_casdoor_id"), "users", ["casdoor_id"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.drop_column("users", "hashed_password")
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_superuser")


def downgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_superuser", sa.BOOLEAN(), autoincrement=False, nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "hashed_password",
            sa.VARCHAR(length=255),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.add_column(
        "users",
        sa.Column("is_active", sa.BOOLEAN(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "users",
        sa.Column("is_verified", sa.BOOLEAN(), autoincrement=False, nullable=False),
    )
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_casdoor_id"), table_name="users")
    op.alter_column(
        "users", "username", existing_type=sa.String(length=50), nullable=False
    )
    op.create_unique_constraint("users_username_key", "users", ["username"])
    op.create_unique_constraint("users_email_key", "users", ["email"])
    op.drop_column("users", "casdoor_id")
    op.drop_constraint(None, "subapps", type_="unique")
    op.drop_column("subapps", "redirect_uris")
    op.drop_column("subapps", "client_secret")
    op.drop_column("subapps", "client_id")
