from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.camera_alias import CameraAlias
from app.models.lens_alias import LensAlias


class AliasService:
    """Service for resolving camera and lens display names from aliases."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._camera_aliases_cache: dict[str, str] = {}
        self._lens_aliases_cache: dict[str, str] = {}
        self._cache_loaded = False

    async def _load_aliases_cache(self) -> None:
        """Load all aliases into memory cache for fast lookups."""
        if self._cache_loaded:
            return

        # Load camera aliases
        camera_result = await self.db.execute(
            select(CameraAlias.original_name, CameraAlias.display_name).where(
                CameraAlias.is_active
            )
        )
        self._camera_aliases_cache = {row[0]: row[1] for row in camera_result.all()}

        # Load lens aliases
        lens_result = await self.db.execute(
            select(LensAlias.original_name, LensAlias.display_name).where(
                LensAlias.is_active
            )
        )
        self._lens_aliases_cache = {row[0]: row[1] for row in lens_result.all()}

        self._cache_loaded = True

    async def get_camera_display_name(
        self, camera_make: str | None, camera_model: str | None
    ) -> str | None:
        """Get display name for camera, combining make and model."""
        if not camera_make or not camera_model:
            return None

        original_name = f"{camera_make} {camera_model}".strip()
        if not original_name:
            return None

        await self._load_aliases_cache()
        return self._camera_aliases_cache.get(original_name, original_name)

    async def get_lens_display_name(self, lens: str | None) -> str | None:
        """Get display name for lens."""
        if not lens:
            return None

        lens = lens.strip()
        if not lens:
            return None

        await self._load_aliases_cache()
        return self._lens_aliases_cache.get(lens, lens)

    async def resolve_photo_display_names(self, photos: list) -> list:
        """Resolve display names for a list of photos."""
        await self._load_aliases_cache()

        for photo in photos:
            # Resolve camera display name
            if hasattr(photo, "camera_make") and hasattr(photo, "camera_model"):
                photo.camera_display_name = await self.get_camera_display_name(
                    photo.camera_make, photo.camera_model
                )
            else:
                photo.camera_display_name = None

            # Resolve lens display name
            if hasattr(photo, "lens"):
                photo.lens_display_name = await self.get_lens_display_name(photo.lens)
            else:
                photo.lens_display_name = None

        return photos


def create_alias_service(db: AsyncSession) -> AliasService:
    """Factory function to create an AliasService instance."""
    return AliasService(db)
