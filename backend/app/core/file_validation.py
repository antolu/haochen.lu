from __future__ import annotations

from typing import ClassVar

import filetype  # type: ignore
from fastapi import HTTPException, UploadFile, status


class FileValidator:
    """Validate uploaded files using magic number detection."""

    ALLOWED_IMAGE_EXTENSIONS: ClassVar[set[str]] = {
        "jpg",
        "jpeg",
        "png",
        "webp",
        "heic",
        "heif",
        "tiff",
        "tif",
        "cr2",
        "crw",
        "nef",
        "arw",
        "dng",
    }

    def __init__(
        self,
        allowed_extensions: set[str] | None = None,
        max_size: int = 50 * 1024 * 1024,
    ) -> None:
        self.allowed_extensions = allowed_extensions
        self.max_size = max_size

    async def validate_file(self, file: UploadFile) -> None:
        """Validate file by magic number. allowed_extensions=None means allow all."""
        chunk = await file.read(8192)
        await file.seek(0)

        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty or cannot be read",
            )

        kind = filetype.guess(chunk)

        if self.allowed_extensions is not None:
            if kind is None:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Could not determine file type.",
                )
            if kind.extension not in self.allowed_extensions:
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail=f"File type '{kind.extension}' is not supported.",
                )

    async def validate_image_file(self, file: UploadFile) -> None:
        """Validate that the file is an image."""
        chunk = await file.read(8192)
        await file.seek(0)

        if not chunk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty or cannot be read",
            )

        kind = filetype.guess(chunk)

        if kind is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail="Could not determine file type. Please upload a valid image file.",
            )

        if kind.extension not in self.ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"File type '{kind.extension}' ({kind.mime}) is not supported. Please upload an image file (JPEG, PNG, WebP, HEIC, TIFF, or RAW formats).",
            )

        if file.content_type and not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Content-Type header indicates non-image file",
            )


file_validator = FileValidator(
    allowed_extensions=FileValidator.ALLOWED_IMAGE_EXTENSIONS
)
