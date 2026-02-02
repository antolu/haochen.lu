from __future__ import annotations

import hashlib
import hmac
import time
from pathlib import Path
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.types.access_control import AccessLevel, FileType


class FileAccessController:
    """Controls access to photo files based on permissions and file type."""

    def __init__(self):
        self.upload_dir = Path(settings.upload_dir).resolve()
        self.compressed_dir = Path(settings.compressed_dir).resolve()

    async def validate_photo_access(
        self,
        db: AsyncSession,
        photo_id: UUID,
        file_type: FileType,
        *,
        user_id: str | None = None,
        is_admin: bool = False,
    ):
        """
        Validate if user can access specified photo file.

        Returns photo model if access is granted, raises HTTPException otherwise.
        """
        # Import here to avoid circular import
        from app.crud.photo import get_photo  # noqa: PLC0415

        # Get photo from database
        photo = await get_photo(db, photo_id)
        if not photo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
            )

        # Get access level (default to public for existing photos)
        access_level = getattr(photo, "access_level", AccessLevel.PUBLIC)

        # Check access permissions
        if access_level == AccessLevel.PRIVATE and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
            )

        if access_level == AccessLevel.AUTHENTICATED and not user_id and not is_admin:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        # Additional restrictions for high-resolution files (only for non-public photos)
        if (
            file_type in [FileType.LARGE, FileType.XLARGE, FileType.ORIGINAL]
            and access_level != AccessLevel.PUBLIC
            and not (user_id or is_admin)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for high-resolution files",
            )

        return photo

    def get_file_path(self, photo, file_type: FileType) -> Path:
        """Get the actual file path for the requested photo and file type."""
        if file_type == FileType.ORIGINAL:
            file_path = self.upload_dir / Path(photo.original_path).name
        else:
            # Get path from variants
            if not photo.variants or not isinstance(photo.variants, dict):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Variant '{file_type}' not available",
                )

            # 1) Direct lookup (legacy flat mapping or precomputed key)
            direct = photo.variants.get(file_type.value)

            def _path_from_variant_info(info: dict) -> Path | None:
                # Legacy shape: { path: "...", ... }
                if (
                    isinstance(info, dict)
                    and "path" in info
                    and isinstance(info["path"], str)
                ):
                    return self.compressed_dir / Path(info["path"]).name
                return None

            resolved_path: Path | None = (
                _path_from_variant_info(direct) if isinstance(direct, dict) else None
            )

            if resolved_path is None:
                # 2) Multi-format nested mapping introduced with libvips:
                # variants[size] -> { "avif": {...}, "webp": {...}, "jpeg": {...} }
                size_part: str
                format_part: str | None
                if "-" in file_type.value:
                    # Explicit format requested, e.g. "medium-avif"
                    size_part, format_part = file_type.value.split("-", 1)
                else:
                    size_part, format_part = file_type.value, None

                size_entry = photo.variants.get(size_part)
                if isinstance(size_entry, dict):
                    if format_part:
                        # Specific format requested
                        fmt_info = size_entry.get(format_part)
                        resolved_path = (
                            _path_from_variant_info(fmt_info)
                            if isinstance(fmt_info, dict)
                            else None
                        )
                    else:
                        # No specific format -> follow priority: avif -> webp -> jpeg
                        for fmt in ("avif", "webp", "jpeg"):
                            fmt_info = size_entry.get(fmt)
                            resolved_path = (
                                _path_from_variant_info(fmt_info)
                                if isinstance(fmt_info, dict)
                                else None
                            )
                            if resolved_path is not None:
                                break

            if resolved_path is None:
                # 3) As a last resort, try to find any entry whose key starts with the size
                # This helps if keys were persisted like "medium-webp"
                size_key = file_type.value.split("-", 1)[0]
                candidate = next(
                    (
                        v
                        for k, v in photo.variants.items()
                        if isinstance(k, str)
                        and k.startswith(size_key)
                        and isinstance(v, dict)
                    ),
                    None,
                )
                resolved_path = (
                    _path_from_variant_info(candidate)
                    if isinstance(candidate, dict)
                    else None
                )

            if resolved_path is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Variant '{file_type}' not found",
                )

            file_path = resolved_path

        # Verify file exists
        if not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk"
            )

        # Security: ensure file is within allowed directories
        try:
            if file_type == FileType.ORIGINAL:
                file_path.resolve().relative_to(self.upload_dir)
            else:
                file_path.resolve().relative_to(self.compressed_dir)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
            ) from e

        return file_path

    def get_content_type(self, file_path: Path) -> str:
        """Determine content type based on file extension."""
        suffix = file_path.suffix.lower()
        content_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".avif": "image/avif",
            ".bmp": "image/bmp",
            ".tiff": "image/tiff",
            ".svg": "image/svg+xml",
        }
        return content_types.get(suffix, "application/octet-stream")

    def get_download_filename(self, photo, file_type: FileType) -> str:
        """Generate appropriate filename for downloads."""
        # Use photo title if available, otherwise use original filename
        base_name = photo.title or Path(photo.filename).stem

        # Clean filename for download
        safe_name = "".join(
            c for c in base_name if c.isalnum() or c in (" ", "-", "_")
        ).rstrip()

        if file_type == FileType.ORIGINAL:
            extension = Path(photo.filename).suffix
        else:
            # Determine extension based on the resolved file path to be accurate across formats
            try:
                resolved_path = self.get_file_path(photo, file_type)
                extension = resolved_path.suffix
            except Exception:
                # Fallback to webp if we cannot resolve
                extension = ".webp"

        # Add variant suffix for non-original files
        if file_type != FileType.ORIGINAL:
            safe_name += f"_{file_type.value}"

        return f"{safe_name}{extension}"

    def generate_temporary_url(
        self,
        photo_id: UUID,
        file_type: FileType,
        expires_in: int = 3600,  # 1 hour default
    ) -> str:
        """Generate a signed temporary URL for file access."""
        timestamp = int(time.time()) + expires_in
        message = f"{photo_id}:{file_type.value}:{timestamp}"
        signature = hmac.new(
            settings.secret_key.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        return f"/api/photos/{photo_id}/file/{file_type.value}?expires={timestamp}&signature={signature}"

    def validate_temporary_url(
        self, photo_id: UUID, file_type: FileType, expires: int, signature: str
    ) -> bool:
        """Validate a signed temporary URL."""
        # Check expiration
        if int(time.time()) > expires:
            return False

        # Verify signature
        message = f"{photo_id}:{file_type.value}:{expires}"
        expected_signature = hmac.new(
            settings.secret_key.encode(), message.encode(), hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(signature, expected_signature)


# Global instance
file_access_controller = FileAccessController()
