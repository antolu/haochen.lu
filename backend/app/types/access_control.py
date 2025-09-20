from __future__ import annotations

from enum import Enum


class AccessLevel(str, Enum):
    """Photo access levels."""
    PUBLIC = "public"          # Anyone can access
    AUTHENTICATED = "authenticated"  # Requires login
    PRIVATE = "private"        # Admin only


class FileType(str, Enum):
    """File type categories."""
    ORIGINAL = "original"
    THUMBNAIL = "thumbnail"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"