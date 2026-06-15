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
    MICRO = "micro"
    THUMBNAIL = "thumbnail"
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"
    # Multi-format variants (format will be auto-detected)
    MICRO_AVIF = "micro-avif"
    THUMBNAIL_AVIF = "thumbnail-avif"
    SMALL_AVIF = "small-avif"
    MEDIUM_AVIF = "medium-avif"
    LARGE_AVIF = "large-avif"
    XLARGE_AVIF = "xlarge-avif"
    MICRO_WEBP = "micro-webp"
    THUMBNAIL_WEBP = "thumbnail-webp"
    SMALL_WEBP = "small-webp"
    MEDIUM_WEBP = "medium-webp"
    LARGE_WEBP = "large-webp"
    XLARGE_WEBP = "xlarge-webp"
    MICRO_JPEG = "micro-jpeg"
    THUMBNAIL_JPEG = "thumbnail-jpeg"
    SMALL_JPEG = "small-jpeg"
    MEDIUM_JPEG = "medium-jpeg"
    LARGE_JPEG = "large-jpeg"
    XLARGE_JPEG = "xlarge-jpeg"
