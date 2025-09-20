from __future__ import annotations

from enum import StrEnum


class AccessLevel(StrEnum):
    """Photo access levels."""

    PUBLIC = "public"  # Anyone can access
    AUTHENTICATED = "authenticated"  # Requires login
    PRIVATE = "private"  # Admin only


class FileType(StrEnum):
    """File type categories."""

    ORIGINAL = "original"
    THUMBNAIL = "thumbnail"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"
