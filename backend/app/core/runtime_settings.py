from __future__ import annotations

from dataclasses import dataclass, field

from app.config import settings as static_settings


@dataclass(slots=True)
class ImageSettings:
    """Runtime-editable image settings.

    Defaults are sourced from static env-based settings but can be overridden at runtime.
    """

    responsive_sizes: dict[str, int] = field(
        default_factory=lambda: dict(static_settings.responsive_sizes)
    )
    quality_settings: dict[str, int] = field(
        default_factory=lambda: dict(static_settings.quality_settings)
    )

    avif_quality_base_offset: int = static_settings.avif_quality_base_offset
    avif_quality_floor: int = static_settings.avif_quality_floor
    avif_effort_default: int = static_settings.avif_effort_default

    webp_quality: int = static_settings.webp_quality

    def apply(self, data: dict) -> None:
        if not data:
            return
        if "responsive_sizes" in data and isinstance(data["responsive_sizes"], dict):
            self.responsive_sizes = {
                str(k): int(v) for k, v in data["responsive_sizes"].items()
            }
        if "quality_settings" in data and isinstance(data["quality_settings"], dict):
            self.quality_settings = {
                str(k): int(v) for k, v in data["quality_settings"].items()
            }
        if "avif_quality_base_offset" in data:
            self.avif_quality_base_offset = int(data["avif_quality_base_offset"])  # type: ignore[arg-type]
        if "avif_quality_floor" in data:
            self.avif_quality_floor = int(data["avif_quality_floor"])  # type: ignore[arg-type]
        if "avif_effort_default" in data:
            self.avif_effort_default = int(data["avif_effort_default"])  # type: ignore[arg-type]
        if "webp_quality" in data:
            self.webp_quality = int(data["webp_quality"])  # type: ignore[arg-type]


_image_settings = ImageSettings()


def get_image_settings() -> ImageSettings:
    return _image_settings


def update_image_settings(data: dict) -> ImageSettings:
    _image_settings.apply(data)
    return _image_settings
