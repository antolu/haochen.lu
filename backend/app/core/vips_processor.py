from __future__ import annotations

import asyncio
import logging
import os
import uuid
from collections.abc import Callable
from contextlib import suppress
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO

import piexif  # type: ignore[import-untyped, import-not-found, unused-ignore]
import pyvips  # type: ignore[import-untyped, import-not-found]

from app.config import settings
from app.core.exif import extract_comprehensive_exif
from app.core.progress import progress_manager

logger = logging.getLogger(__name__)

# Configure pyvips global cache once at module level
pyvips.cache_set_max(100)  # Set cache size
pyvips.cache_set_max_mem(100 * 1024 * 1024)  # 100MB cache


@dataclass(slots=True)
class ImageVariantConfig:
    """Plain image-processing configuration values, decoupled from SystemConfigService."""

    responsive_sizes: dict[str, int]
    quality_settings: dict[str, int]
    avif_quality_base_offset: int
    avif_quality_floor: int
    avif_effort_default: int


class VipsImageProcessor:
    """High-performance image processor using libvips with AVIF/WebP/JPEG support."""

    def __init__(
        self,
        upload_dir: str,
        compressed_dir: str,
        config: ImageVariantConfig,
        progress_callback: Callable[[str, int], None] | None = None,
        *,
        upload_id: str | None = None,
    ):
        self.upload_dir = Path(upload_dir).resolve()
        self.compressed_dir = Path(compressed_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)
        self.compressed_dir.mkdir(exist_ok=True, parents=True)
        self.config = config
        self.progress_callback = progress_callback
        self.upload_id = upload_id
        self._progress_task: asyncio.Task | None = None

    def _update_progress(self, stage: str, progress: int) -> None:
        """Update progress if callback is available."""
        if self.progress_callback:
            self.progress_callback(stage, progress)
        if self.upload_id:
            # Cancel previous task if still running to avoid buildup
            if self._progress_task and not self._progress_task.done():
                self._progress_task.cancel()

            try:
                loop = asyncio.get_running_loop()
                # We are in an active event loop (main thread). Schedule task.
                self._progress_task = loop.create_task(
                    progress_manager.send_progress(self.upload_id, stage, progress)
                )
            except RuntimeError:
                # No running event loop in this thread (likely from to_thread). Run synchronously.
                with suppress(RuntimeError):
                    asyncio.run(
                        progress_manager.send_progress(self.upload_id, stage, progress)
                    )

    async def _read_exif_with_vips(self, image_path: str) -> dict[str, Any]:
        vips_image = pyvips.Image.new_from_file(image_path, access="sequential")
        exif_data: dict[str, Any] = {
            "width": vips_image.width,
            "height": vips_image.height,
        }

        self._update_progress("exif", 30)

        try:
            exif_dict = piexif.load(image_path)
            comprehensive_data = await extract_comprehensive_exif(exif_dict)
            exif_data.update(comprehensive_data)
        except Exception:
            if vips_image.get_typeof("exif") != 0:
                vips_exif = vips_image.get("exif")
                exif_data.update(self._extract_vips_exif(vips_exif))

        self._update_progress("exif", 40)
        return exif_data

    async def extract_exif_data(self, image_path: str) -> dict[str, Any]:
        """Extract comprehensive EXIF data from image including timezone and GPS."""
        self._update_progress("exif", 20)
        exif_data: dict[str, Any] = {}

        try:
            exif_data = await self._read_exif_with_vips(image_path)
        except Exception:
            logger.exception("Error extracting EXIF data")

        return exif_data

    def _extract_vips_exif(self, exif_bytes: bytes) -> dict[str, Any]:
        """Fallback EXIF extraction using vips data."""
        # This is a simplified fallback - in practice, you'd parse the EXIF bytes
        return {}

    async def process_image(
        self, file: BinaryIO, filename: str, title: str | None = None
    ) -> dict:
        """Process uploaded image: save original, create multiple responsive sizes in AVIF/WebP/JPEG."""

        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_ext = Path(filename).suffix.lower()
        original_filename = f"{file_id}{file_ext}"

        # File paths
        original_path = self.upload_dir / original_filename

        self._update_progress("upload", 10)

        # Save original file
        with open(original_path, "wb") as buffer:
            content = await asyncio.to_thread(file.read)
            buffer.write(content)

        self._update_progress("upload", 20)

        # Extract EXIF data
        exif_data = await self.extract_exif_data(str(original_path))

        self._update_progress("processing", 50)

        # Generate all responsive sizes with multiple formats
        variants = await asyncio.to_thread(
            self._generate_responsive_variants, original_path, file_id
        )

        self._update_progress("complete", 100)

        # Get file size
        file_size = original_path.stat().st_size

        return {
            "filename": original_filename,
            "original_path": f"/uploads/{original_filename}",
            "file_size": file_size,
            "variants": variants,
            **exif_data,
        }

    def _save_avif_variant(
        self, resized_img: pyvips.Image, file_id: str, size_name: str
    ) -> dict | None:
        avif_filename = f"{file_id}_{size_name}.avif"
        avif_path = self.compressed_dir / avif_filename
        avif_quality = self._get_avif_quality(size_name)
        try:
            resized_img.heifsave(
                str(avif_path),
                Q=avif_quality["quality"],
                effort=avif_quality["effort"],
                compression="av1",
            )
        except Exception:
            logger.exception("Error generating AVIF for %s", size_name)
            return None
        return {
            "path": f"/compressed/{avif_filename}",
            "filename": avif_filename,
            "width": resized_img.width,
            "height": resized_img.height,
            "size_bytes": avif_path.stat().st_size,
            "format": "avif",
            "mime_type": "image/avif",
        }

    def _save_webp_variant(
        self, resized_img: pyvips.Image, file_id: str, size_name: str, webp_quality: int
    ) -> dict | None:
        webp_filename = f"{file_id}_{size_name}.webp"
        webp_path = self.compressed_dir / webp_filename
        try:
            resized_img.webpsave(str(webp_path), Q=webp_quality, effort=6)
        except Exception:
            logger.exception("Error generating WebP for %s", size_name)
            return None
        return {
            "path": f"/compressed/{webp_filename}",
            "filename": webp_filename,
            "width": resized_img.width,
            "height": resized_img.height,
            "size_bytes": webp_path.stat().st_size,
            "format": "webp",
            "mime_type": "image/webp",
        }

    def _save_jpeg_variant(
        self, resized_img: pyvips.Image, file_id: str, size_name: str, jpeg_quality: int
    ) -> dict | None:
        jpeg_filename = f"{file_id}_{size_name}.jpg"
        jpeg_path = self.compressed_dir / jpeg_filename
        try:
            resized_img.jpegsave(
                str(jpeg_path), Q=jpeg_quality, optimize_coding=True, interlace=True
            )
        except Exception:
            logger.exception("Error generating JPEG for %s", size_name)
            return None
        return {
            "path": f"/compressed/{jpeg_filename}",
            "filename": jpeg_filename,
            "width": resized_img.width,
            "height": resized_img.height,
            "size_bytes": jpeg_path.stat().st_size,
            "format": "jpeg",
            "mime_type": "image/jpeg",
        }

    def _generate_variant_formats(
        self,
        vips_image: pyvips.Image,
        file_id: str,
        size_name: str,
        target_size: int,
    ) -> dict:
        resized_img = self._resize_image_vips(vips_image, target_size)
        variant_formats = {}

        avif = self._save_avif_variant(resized_img, file_id, size_name)
        if avif is not None:
            variant_formats["avif"] = avif

        webp_quality = self.config.quality_settings.get(
            size_name, settings.webp_quality
        )
        webp = self._save_webp_variant(resized_img, file_id, size_name, webp_quality)
        if webp is not None:
            variant_formats["webp"] = webp

        jpeg_quality = min(webp_quality + 5, 95)
        jpeg = self._save_jpeg_variant(resized_img, file_id, size_name, jpeg_quality)
        if jpeg is not None:
            variant_formats["jpeg"] = jpeg

        return variant_formats

    def _build_vips_variants(self, vips_image: pyvips.Image, file_id: str) -> dict:
        vips_image = vips_image.autorot()
        if vips_image.interpretation != "srgb":
            vips_image = vips_image.colourspace("srgb")

        original_width, original_height = vips_image.width, vips_image.height
        total_variants = len(self.config.responsive_sizes)
        progress_per_variant: float = 30.0 / total_variants if total_variants else 30.0
        current_progress: float = 60.0

        variants = {}
        for size_name, target_size in self.config.responsive_sizes.items():
            if target_size > max(original_width, original_height):
                continue
            variants[size_name] = self._generate_variant_formats(
                vips_image, file_id, size_name, target_size
            )
            current_progress += progress_per_variant
            self._update_progress("processing", int(current_progress))

        return variants

    def _generate_responsive_variants(self, original_path: Path, file_id: str) -> dict:
        """Generate multiple responsive image sizes in AVIF, WebP, and JPEG formats."""
        try:
            vips_image = pyvips.Image.new_from_file(
                str(original_path), access="sequential"
            )
            return self._build_vips_variants(vips_image, file_id)
        except Exception:
            logger.exception("Error generating responsive variants")
            raise

    def _resize_image_vips(
        self, vips_image: pyvips.Image, target_size: int
    ) -> pyvips.Image:
        """Resize image maintaining aspect ratio using vips."""
        width, height = vips_image.width, vips_image.height

        scale = target_size / width if width > height else target_size / height

        # Use lanczos kernel for high-quality resizing
        return vips_image.resize(scale, kernel="lanczos3")

    def _get_avif_quality(self, size_name: str) -> dict[str, int]:
        """Get AVIF-specific quality settings for different sizes."""
        base_quality = self.config.quality_settings.get(
            size_name, settings.webp_quality
        )

        # AVIF can achieve better compression, so we can use slightly lower quality
        avif_quality = max(
            base_quality + self.config.avif_quality_base_offset,
            self.config.avif_quality_floor,
        )

        # Adjust effort based on size (higher effort for smaller sizes)
        effort_map = {
            "thumbnail": 8,  # Maximum effort for thumbnails
            "small": 7,
            "medium": 6,
            "large": 5,
            "xlarge": 4,  # Lower effort for large files (speed vs quality)
        }

        return {
            "quality": int(avif_quality),
            "effort": int(effort_map.get(size_name, self.config.avif_effort_default)),
        }

    async def process(self, file: BinaryIO, filename: str) -> dict:
        return await self.process_image(file, filename)

    async def delete_image_files(self, photo_data: dict):
        """Delete all files associated with a photo."""
        files_to_delete = [
            photo_data.get("original_path"),
        ]

        # Add all variant files (now includes multiple formats per size)
        variants = photo_data.get("variants", {})
        for size_variants in variants.values():
            if isinstance(size_variants, dict):
                files_to_delete.extend(
                    format_data["path"]
                    for format_data in size_variants.values()
                    if isinstance(format_data, dict) and format_data.get("path")
                )

        for file_path in files_to_delete:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    logger.exception("Error deleting file %s", file_path)

    @staticmethod
    def get_image_url(
        photo_data: dict,
        size: str = "medium",
        format_preference: str = "avif",
        base_url: str = "",
    ) -> str:
        """Get the appropriate image URL for a given size with format preference."""
        variants = photo_data.get("variants", {})

        # Try to get the requested size
        if size in variants:
            size_variants = variants[size]

            # Try preferred format first, then fallback chain: AVIF -> WebP -> JPEG
            format_chain = [format_preference, "avif", "webp", "jpeg"]
            for fmt in format_chain:
                if fmt in size_variants and size_variants[fmt].get("path"):
                    path = size_variants[fmt]["path"]
                    return f"{base_url}/{path}" if base_url else path

        # Fallback to available sizes in order of preference
        fallback_sizes = ["medium", "small", "large", "thumbnail", "xlarge"]
        for fallback_size in fallback_sizes:
            if fallback_size in variants:
                size_variants = variants[fallback_size]
                format_chain = [format_preference, "avif", "webp", "jpeg"]
                for fmt in format_chain:
                    if fmt in size_variants and size_variants[fmt].get("path"):
                        path = size_variants[fmt]["path"]
                        return f"{base_url}/{path}" if base_url else path

        return ""

    @staticmethod
    def get_image_srcset(
        photo_data: dict, format_preference: str = "avif", base_url: str = ""
    ) -> str:
        """Generate srcset string for responsive images with format preference."""
        variants = photo_data.get("variants", {})
        srcset_parts = []

        for size_variants in variants.values():
            if not isinstance(size_variants, dict):
                continue

            # Use format preference with fallback
            format_chain = [format_preference, "avif", "webp", "jpeg"]
            for fmt in format_chain:
                if fmt in size_variants and size_variants[fmt].get("width"):
                    variant_data = size_variants[fmt]
                    path = variant_data["path"]
                    width = variant_data["width"]
                    url = f"{base_url}/{path}" if base_url else path
                    srcset_parts.append(f"{url} {width}w")
                    break  # Use first available format

        return ", ".join(srcset_parts)


def _default_image_variant_config() -> ImageVariantConfig:
    return ImageVariantConfig(
        responsive_sizes=dict(settings.responsive_sizes),
        quality_settings=dict(settings.quality_settings),
        avif_quality_base_offset=settings.avif_quality_base_offset,
        avif_quality_floor=settings.avif_quality_floor,
        avif_effort_default=settings.avif_effort_default,
    )


# Global instance (used as a fallback / for non-request contexts)
vips_image_processor = VipsImageProcessor(
    settings.upload_dir, settings.compressed_dir, _default_image_variant_config()
)
