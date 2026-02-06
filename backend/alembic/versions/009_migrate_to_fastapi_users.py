"""migrate_to_fastapi_users

Revision ID: 009_migrate_to_fastapi_users
Revises: 008_add_github_url
Create Date: 2025-01-06

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "009_migrate_to_fastapi_users"
down_revision = "008_add_github_url"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add is_verified column (required by fastapi-users)
    op.add_column("users", sa.Column("is_verified", sa.Boolean(), nullable=True))

    # Add is_superuser column (required by fastapi-users)
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=True))

    # Set existing users as verified and copy is_admin to is_superuser
    op.execute("UPDATE users SET is_verified = true WHERE is_verified IS NULL")
    op.execute("UPDATE users SET is_superuser = is_admin WHERE is_superuser IS NULL")

    # Make columns non-nullable
    op.alter_column("users", "is_verified", nullable=False)
    op.alter_column("users", "is_superuser", nullable=False)

    # Note: email field already exists and is nullable, which is fine for fastapi-users
    # Note: hashed_password field already exists, which is what fastapi-users expects
    # Note: is_active field already exists, which is what fastapi-users expects
    # Note: id field is already UUID, which matches SQLAlchemyBaseUserTableUUID


def downgrade() -> None:
    op.drop_column("users", "is_verified")
    op.drop_column("users", "is_superuser")
