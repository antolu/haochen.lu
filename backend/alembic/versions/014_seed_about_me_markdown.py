"""seed_about_me_markdown

Revision ID: 014_seed_about_me_markdown
Revises: 013_oidc_auth
Create Date: 2026-03-19 12:55:41.504690

"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "014_seed_about_me_markdown"
down_revision = "013_oidc_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Define the content table
    content_table = sa.table(
        "content",
        sa.column("id", sa.UUID),
        sa.column("key", sa.String),
        sa.column("title", sa.String),
        sa.column("content", sa.Text),
        sa.column("content_type", sa.String),
        sa.column("category", sa.String),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime),
        sa.column("updated_at", sa.DateTime),
    )

    # About Bio
    op.bulk_insert(
        content_table,
        [
            {
                "id": str(uuid4()),
                "key": "about.bio",
                "title": "Biography",
                "content": (
                    "My name is Anton (Hào-chen) Lu, and I'm a M.Sc. student at KTH Royal Institute of Technology "
                    "in Stockholm, Sweden. I'm currently enrolled in a five-year degree programme in Engineering "
                    "Physics, pursuing a M.Sc. in Machine Learning with specialization in deep learning and "
                    "computational linguistics.\n\n"
                    "My biggest passion is learning new things, whether it be a new problem solving method, "
                    "a new programming language, a new spoken language, or how to capture the perfect moment "
                    "through photography."
                ),
                "content_type": "markdown",
                "category": "about",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            },
            {
                "id": str(uuid4()),
                "key": "about.interests",
                "title": "Interests",
                "content": (
                    "* 📸 Photography\n* 🎮 Gaming\n* 💻 Programming\n* 🏊 Swimming"
                ),
                "content_type": "markdown",
                "category": "about",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            },
            {
                "id": str(uuid4()),
                "key": "about.skills",
                "title": "Skills",
                "content": (
                    "* 🤖 Machine Learning\n"
                    "* 📊 Data Science\n"
                    "* 🌐 Web Development\n"
                    "* 🎯 Deep Learning"
                ),
                "content_type": "markdown",
                "category": "about",
                "is_active": True,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
            },
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM content WHERE key IN ('about.bio', 'about.interests', 'about.skills')"
    )
