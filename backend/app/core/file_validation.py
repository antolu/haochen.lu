from __future__ import annotations

from typing import ClassVar

import filetype  # type: ignore
from fastapi import HTTPException, UploadFile, status


class FileValidator:
    """Validate file types using magic number (file signature) detection."""

    ALLOWED_IMAGE_EXTENSIONS: ClassVar[set[str]] = {
        "jpg",
        "jpeg",
        "png",
        "webp",
        "heic",
        "heif",
        "tiff",
        "tif",
        "cr2",  # Canon RAW
        "crw",
        "nef",  # Nikon RAW
        "arw",  # Sony RAW
        "dng",  # Adobe DNG
    }

    @classmethod
    async def validate_image_file(cls, file: UploadFile) -> None:
        """Validate that uploaded file is actually an image by checking magic numbers.

        Args:
            file: The uploaded file to validate

        Raises:
            HTTPException: If file is not a valid image
        """
        # Read first 8KB for magic number detection (enough for most formats)
        chunk = await file.read(8192)
        await file.seek(0)  # Reset file pointer for later processing

        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty or cannot be read",
            )

        # Detect file type using magic numbers
        kind = filetype.guess(chunk)

        if kind is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Could not determine file type. Please upload a valid image file.",
            )

        # Check if it's an allowed image type
        if kind.extension not in cls.ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type '{kind.extension}' ({kind.mime}) is not supported. Please upload an image file (JPEG, PNG, WebP, HEIC, TIFF, or RAW formats).",
            )

        # Also check Content-Type header matches (defense in depth)
        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content-Type header indicates non-image file",
            )


file_validator = FileValidator()
