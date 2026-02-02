"""add social github url content

Revision ID: 008_add_github_url
Revises: 007_add_project_images
Create Date: 2025-09-27 23:08:02.487913

"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "008_add_github_url"
down_revision = "007_add_project_images"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Insert social.github_url content entry using raw SQL for proper UUID handling
    op.execute(
        "INSERT INTO content (id, key, title, content, content_type, category, is_active) "
        "VALUES (gen_random_uuid(), 'social.github_url', 'GitHub Profile URL', "
        "'https://github.com/antonlu', 'text', 'social', true)"
    )


def downgrade() -> None:
    # Remove social.github_url content entry
    op.execute("DELETE FROM content WHERE key = 'social.github_url'")
