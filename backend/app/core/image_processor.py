from __future__ import annotations

import asyncio
import contextlib
import logging
import os
import typing
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO

import piexif
from PIL import Image
from PIL.ExifTags import TAGS

from app.config import settings
from app.core.exif import extract_comprehensive_exif

logger = logging.getLogger(__name__)


class ImageProcessor:
    def __init__(self, upload_dir: str, compressed_dir: str):
        self.upload_dir = Path(upload_dir).resolve()
        self.compressed_dir = Path(compressed_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)
        self.compressed_dir.mkdir(exist_ok=True, parents=True)

    async def _read_exif_from_image(self, image_path: str) -> dict[str, Any]:
        with Image.open(image_path) as img:
            exif_data: dict[str, Any] = {"width": img.width, "height": img.height}
            try:
                exif_dict = piexif.load(image_path)
                comprehensive_data = await extract_comprehensive_exif(exif_dict)
                exif_data.update(comprehensive_data)
            except Exception:
                if hasattr(img, "_getexif") and img._getexif() is not None:
                    exif = img._getexif()
                    exif_data.update(self._extract_basic_exif(exif))
            return exif_data

    async def extract_exif_data(self, image_path: str) -> dict[str, Any]:
        """Extract comprehensive EXIF data from image including timezone and GPS."""
        try:
            return await self._read_exif_from_image(image_path)
        except Exception:
            logger.exception("Error extracting EXIF data")
            return {}

    def _extract_basic_exif(self, exif: dict[typing.Any, typing.Any]) -> dict[str, Any]:
        """Fallback basic EXIF extraction using PIL."""
        data: dict[str, Any] = {}

        for tag_id, value in exif.items():
            tag = TAGS.get(tag_id, tag_id)

            if tag == "DateTime":
                with contextlib.suppress(ValueError, TypeError):
                    data["date_taken"] = datetime.strptime(
                        str(value), "%Y:%m:%d %H:%M:%S"
                    )

            elif tag == "Make":
                data["camera_make"] = str(value).strip()

            elif tag == "Model":
                data["camera_model"] = str(value).strip()

            elif tag == "LensModel":
                data["lens"] = str(value).strip()

            elif tag == "ISOSpeedRatings":
                data["iso"] = int(value) if isinstance(value, (int, float)) else None

            elif tag == "FNumber":
                if hasattr(value, "num") and hasattr(value, "den") and value.den != 0:
                    data["aperture"] = float(value.num / value.den)
                elif isinstance(value, (int, float)):
                    data["aperture"] = float(value)

            elif tag == "ExposureTime":
                if hasattr(value, "num") and hasattr(value, "den"):
                    if value.num == 1:
                        data["shutter_speed"] = f"1/{value.den}"
                    else:
                        data["shutter_speed"] = f"{value.num}/{value.den}"

            elif tag == "FocalLength":
                if hasattr(value, "num") and hasattr(value, "den"):
                    data["focal_length"] = int(value.num / value.den)

            elif tag == "GPSInfo":
                gps_data = self._extract_gps_data(value)
                data.update(gps_data)

        return data

    @staticmethod
    def _dms_to_decimal_basic(dms: tuple[float, float, float], ref: str) -> float:
        decimal = float(dms[0]) + float(dms[1]) / 60.0 + float(dms[2]) / 3600.0
        return -decimal if ref in ("S", "W") else decimal

    def _extract_gps_data(
        self, gps_info: dict[int | str, typing.Any]
    ) -> dict[str, typing.Any]:
        """Fallback GPS extraction for PIL-based EXIF."""
        try:
            lat_dms = gps_info.get(2)
            lat_ref = gps_info.get(1)
            lon_dms = gps_info.get(4)
            lon_ref = gps_info.get(3)
            if lat_dms and lat_ref and lon_dms and lon_ref:
                return {
                    "location_lat": self._dms_to_decimal_basic(lat_dms, lat_ref),
                    "location_lon": self._dms_to_decimal_basic(lon_dms, lon_ref),
                }
        except Exception:
            logger.exception("Error extracting GPS data")
        return {}

    async def process_image(
        self, file: BinaryIO, filename: str, title: str | None = None
    ) -> dict[str, typing.Any]:
        """Process uploaded image: save original, create multiple responsive sizes."""

        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_ext = Path(filename).suffix.lower()
        original_filename = f"{file_id}{file_ext}"

        # File paths
        original_path = self.upload_dir / original_filename

        # Save original file
        with open(original_path, "wb") as buffer:
            content = await asyncio.to_thread(file.read)
            buffer.write(content)

        # Extract EXIF data
        exif_data = await self.extract_exif_data(str(original_path))

        # Generate all responsive sizes
        variants = await asyncio.to_thread(
            self._generate_responsive_variants, original_path, file_id
        )

        # Get file size
        file_size = original_path.stat().st_size

        return {
            "filename": original_filename,
            "original_path": f"/uploads/{original_filename}",
            "file_size": file_size,
            "variants": variants,
            **exif_data,
        }

    def _build_variants(self, img: Image.Image, file_id: str) -> dict[str, typing.Any]:
        processed = self._auto_rotate_image(img)
        if processed.mode in ("RGBA", "LA", "P"):
            processed = processed.convert("RGB")
        original_width, original_height = processed.size
        variants: dict[str, typing.Any] = {}
        for size_name, target_size in settings.responsive_sizes.items():
            if target_size > max(original_width, original_height):
                continue
            resized = self._resize_image(processed, target_size)
            webp_filename = f"{file_id}_{size_name}.webp"
            webp_path = self.compressed_dir / webp_filename
            resized.save(
                webp_path,
                format="WEBP",
                quality=settings.quality_settings.get(size_name, 85),
                method=6,
            )
            variants[size_name] = {
                "path": f"/compressed/{webp_filename}",
                "filename": webp_filename,
                "width": resized.width,
                "height": resized.height,
                "size_bytes": webp_path.stat().st_size,
                "format": "webp",
            }
        return variants

    def _generate_responsive_variants(
        self, original_path: Path, file_id: str
    ) -> dict[str, typing.Any]:
        """Generate multiple responsive image sizes."""
        try:
            with Image.open(original_path) as opened_img:
                return self._build_variants(opened_img, file_id)
        except Exception:
            logger.exception("Error generating responsive variants")
            raise

    @staticmethod
    def _apply_orientation(img: Image.Image, orientation: int) -> Image.Image:
        if orientation == 3:
            return img.rotate(180, expand=True)
        if orientation == 6:
            return img.rotate(270, expand=True)
        if orientation == 8:
            return img.rotate(90, expand=True)
        return img

    def _auto_rotate_image(self, img: Image.Image) -> Image.Image:
        """Auto-rotate image based on EXIF orientation."""
        try:
            if hasattr(img, "_getexif") and img._getexif() is not None:
                exif = img._getexif()
                if exif is not None:
                    orientation = exif.get(0x0112)
                    if orientation:
                        return self._apply_orientation(img, orientation)
        except Exception:
            logger.exception("Error auto-rotating image")
        return img

    def _resize_image(self, img: Image.Image, target_size: int) -> Image.Image:
        """Resize image maintaining aspect ratio."""
        # Calculate new dimensions maintaining aspect ratio
        width, height = img.size

        if width > height:
            new_width = target_size
            new_height = int((height * target_size) / width)
        else:
            new_height = target_size
            new_width = int((width * target_size) / height)

        # Resize with high-quality resampling
        return img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    async def delete_image_files(self, photo_data: dict[str, typing.Any]) -> None:
        """Delete all files associated with a photo."""
        files_to_delete = [
            photo_data.get("original_path"),
        ]

        # Add all variant files
        variants = photo_data.get("variants", {})
        files_to_delete.extend(
            variant_data["path"]
            for variant_data in variants.values()
            if isinstance(variant_data, dict) and variant_data.get("path")
        )

        for file_path in files_to_delete:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception:
                    logger.exception("Error deleting file %s", file_path)

    @staticmethod
    def get_image_url(
        photo_data: dict[str, typing.Any], size: str = "medium", base_url: str = ""
    ) -> str:
        """Get the appropriate image URL for a given size."""
        variants = photo_data.get("variants", {})

        # Try to get the requested size
        if size in variants:
            path: str = variants[size]["path"]
            return f"{base_url}/{path}" if base_url else path

        # Fallback to available sizes in order of preference
        fallback_sizes = ["medium", "small", "large", "thumbnail", "micro", "xlarge"]
        for fallback_size in fallback_sizes:
            if fallback_size in variants:
                path = variants[fallback_size]["path"]
                return f"{base_url}/{path}" if base_url else path

        return ""

    @staticmethod
    def get_image_srcset(photo_data: dict[str, typing.Any], base_url: str = "") -> str:
        """Generate srcset string for responsive images."""
        variants = photo_data.get("variants", {})
        srcset_parts = []

        for variant_data in variants.values():
            if isinstance(variant_data, dict) and variant_data.get("width"):
                path = variant_data["path"]
                width = variant_data["width"]
                url = f"{base_url}/{path}" if base_url else path
                srcset_parts.append(f"{url} {width}w")

        return ", ".join(srcset_parts)


# Global instance
image_processor = ImageProcessor(settings.upload_dir, settings.compressed_dir)
