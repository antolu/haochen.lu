from __future__ import annotations


class ImageProcessingError(Exception):
    """Raised when image processing fails."""


class UnsupportedFileTypeError(ImageProcessingError):
    """Raised when an uploaded file type is not supported."""


class ValidationError(Exception):
    """Generic validation error for business logic and services."""


class BusinessLogicError(Exception):
    """Raised for domain-specific business rule violations."""
