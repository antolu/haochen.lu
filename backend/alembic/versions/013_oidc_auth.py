"""oidc sso and user refactor

Revision ID: 013_oidc_auth
Revises: 012_remove_photo_fields
Create Date: 2026-03-26 15:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "013_oidc_auth"
down_revision = "012_remove_photo_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SubApps Table: Add OIDC fields
    op.add_column(
        "subapps", sa.Column("client_id", sa.String(length=100), nullable=True)
    )
    op.add_column(
        "subapps", sa.Column("client_secret", sa.String(length=100), nullable=True)
    )
    op.add_column("subapps", sa.Column("redirect_uris", sa.Text(), nullable=True))
    op.add_column(
        "subapps", sa.Column("admin_url", sa.String(length=500), nullable=True)
    )
    op.create_unique_constraint(None, "subapps", ["client_id"])

    # Users Table: Refactor for OIDC
    op.add_column("users", sa.Column("oidc_id", sa.String(length=255), nullable=True))
    # Since we are wiping the db, we don't need to migrate legacy ids,
    # but we'll keep the column nullable=False logic.
    op.alter_column("users", "oidc_id", nullable=False)

    # Remove local auth fields as we move to SSO only
    op.drop_column("users", "hashed_password")
    op.drop_column("users", "is_active")
    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_superuser")

    # Fix username/email constraints
    op.drop_constraint("users_email_key", "users", type_="unique")
    op.drop_constraint("users_username_key", "users", type_="unique")
    op.alter_column(
        "users", "username", existing_type=sa.String(length=50), nullable=True
    )

    # Indexes
    op.create_index(op.f("ix_users_oidc_id"), "users", ["oidc_id"], unique=True)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)


def downgrade() -> None:
    # This is a one-way street in this project's context, but for safety:
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_index(op.f("ix_users_oidc_id"), table_name="users")
    op.create_unique_constraint("users_username_key", "users", ["username"])
    op.create_unique_constraint("users_email_key", "users", ["email"])

    op.add_column(
        "users",
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "users",
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default="true"),
    )
    op.add_column(
        "users",
        sa.Column(
            "hashed_password", sa.String(length=255), nullable=False, server_default=""
        ),
    )

    op.drop_column("users", "oidc_id")
    op.drop_column("subapps", "admin_url")
    op.drop_column("subapps", "redirect_uris")
    op.drop_column("subapps", "client_secret")
    op.drop_column("subapps", "client_id")
