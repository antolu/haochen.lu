"""remove section titles

Revision ID: 011_remove_section_titles
Revises: 010_add_unique_aliases
Create Date: 2026-03-08 03:00:00.000000

"""

from __future__ import annotations

from alembic import op

# revision identifiers, used by Alembic.
revision = "011_remove_section_titles"
down_revision = "010_add_unique_aliases"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "DELETE FROM content WHERE key IN ("
        "'about.title', "
        "'photography.title', "
        "'projects.title', "
        "'contact.title'"
        ")"
    )


def downgrade() -> None:
    pass
