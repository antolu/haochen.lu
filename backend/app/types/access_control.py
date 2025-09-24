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
    # Multi-format variants (format will be auto-detected)
    THUMBNAIL_AVIF = "thumbnail-avif"
    SMALL_AVIF = "small-avif"
    MEDIUM_AVIF = "medium-avif"
    LARGE_AVIF = "large-avif"
    XLARGE_AVIF = "xlarge-avif"
    THUMBNAIL_WEBP = "thumbnail-webp"
    SMALL_WEBP = "small-webp"
    MEDIUM_WEBP = "medium-webp"
    LARGE_WEBP = "large-webp"
    XLARGE_WEBP = "xlarge-webp"
    THUMBNAIL_JPEG = "thumbnail-jpeg"
    SMALL_JPEG = "small-jpeg"
    MEDIUM_JPEG = "medium-jpeg"
    LARGE_JPEG = "large-jpeg"
    XLARGE_JPEG = "xlarge-jpeg"
