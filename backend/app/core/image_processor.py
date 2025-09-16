from __future__ import annotations

import asyncio
import contextlib
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

from PIL import Image
from PIL.ExifTags import TAGS

from app.config import settings


class ImageProcessor:
    def __init__(self, upload_dir: str, compressed_dir: str):
        self.upload_dir = Path(upload_dir).resolve()
        self.compressed_dir = Path(compressed_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)
        self.compressed_dir.mkdir(exist_ok=True, parents=True)

    def extract_exif_data(self, image_path: str) -> dict:
        """Extract EXIF data from image."""
        exif_data = {}

        try:
            with Image.open(image_path) as img:
                # Get basic image info
                exif_data["width"] = img.width
                exif_data["height"] = img.height

                # Get EXIF data
                if hasattr(img, "_getexif") and img._getexif() is not None:
                    exif = img._getexif()

                    for tag_id, value in exif.items():
                        tag = TAGS.get(tag_id, tag_id)

                        if tag == "DateTime":
                            with contextlib.suppress(ValueError, TypeError):
                                exif_data["date_taken"] = datetime.strptime(
                                    str(value), "%Y:%m:%d %H:%M:%S"
                                )

                        elif tag == "Make":
                            exif_data["camera_make"] = str(value).strip()

                        elif tag == "Model":
                            exif_data["camera_model"] = str(value).strip()

                        elif tag == "LensModel":
                            exif_data["lens"] = str(value).strip()

                        elif tag == "ISOSpeedRatings":
                            exif_data["iso"] = (
                                int(value) if isinstance(value, (int, float)) else None
                            )

                        elif tag == "FNumber":
                            if hasattr(value, "num") and hasattr(value, "den"):
                                exif_data["aperture"] = float(value.num / value.den)
                            elif isinstance(value, (int, float)):
                                exif_data["aperture"] = float(value)

                        elif tag == "ExposureTime":
                            if hasattr(value, "num") and hasattr(value, "den"):
                                if value.num == 1:
                                    exif_data["shutter_speed"] = f"1/{value.den}"
                                else:
                                    exif_data["shutter_speed"] = (
                                        f"{value.num}/{value.den}"
                                    )

                        elif tag == "FocalLength":
                            if hasattr(value, "num") and hasattr(value, "den"):
                                exif_data["focal_length"] = int(value.num / value.den)

                        elif tag == "GPSInfo":
                            gps_data = self._extract_gps_data(value)
                            exif_data.update(gps_data)

        except Exception as e:
            print(f"Error extracting EXIF data: {e}")

        return exif_data

    def _extract_gps_data(self, gps_info: dict) -> dict:
        """Extract GPS coordinates from EXIF GPS info."""
        gps_data = {}

        try:

            def get_decimal_from_dms(dms, ref):
                degrees = float(dms[0])
                minutes = float(dms[1])
                seconds = float(dms[2])

                decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)

                if ref in ["S", "W"]:
                    decimal = -decimal

                return decimal

            lat_dms = gps_info.get(2)
            lat_ref = gps_info.get(1)
            lon_dms = gps_info.get(4)
            lon_ref = gps_info.get(3)

            if lat_dms and lat_ref and lon_dms and lon_ref:
                gps_data["location_lat"] = get_decimal_from_dms(lat_dms, lat_ref)
                gps_data["location_lon"] = get_decimal_from_dms(lon_dms, lon_ref)

        except Exception as e:
            print(f"Error extracting GPS data: {e}")

        return gps_data

    async def process_image(
        self, file: BinaryIO, filename: str, title: str | None = None
    ) -> dict:
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
        exif_data = await asyncio.to_thread(self.extract_exif_data, str(original_path))

        # Generate all responsive sizes
        variants = await asyncio.to_thread(
            self._generate_responsive_variants, original_path, file_id
        )

        # Get file size
        file_size = original_path.stat().st_size

        return {
            "filename": original_filename,
            "original_path": str(original_path),
            "file_size": file_size,
            "variants": variants,
            **exif_data,
        }

    def _generate_responsive_variants(self, original_path: Path, file_id: str) -> dict:
        """Generate multiple responsive image sizes."""
        variants = {}

        try:
            with Image.open(original_path) as img:
                # Auto-rotate based on EXIF orientation
                img = self._auto_rotate_image(img)

                # Convert to RGB if necessary
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                # Get original dimensions
                original_width, original_height = img.size

                # Generate each responsive size
                for size_name, target_size in settings.responsive_sizes.items():
                    quality = settings.quality_settings.get(size_name, 85)

                    # Skip if target size is larger than original
                    if target_size > max(original_width, original_height):
                        continue

                    # Create resized image
                    resized_img = self._resize_image(img, target_size)

                    # Save WebP version
                    webp_filename = f"{file_id}_{size_name}.webp"
                    webp_path = self.compressed_dir / webp_filename

                    resized_img.save(
                        webp_path,
                        format="WEBP",
                        quality=quality,
                        method=6,  # Best compression
                    )

                    variants[size_name] = {
                        "path": str(webp_path),
                        "filename": webp_filename,
                        "width": resized_img.width,
                        "height": resized_img.height,
                        "size_bytes": webp_path.stat().st_size,
                        "format": "webp",
                    }

        except Exception as e:
            print(f"Error generating responsive variants: {e}")
            raise

        return variants

    def _auto_rotate_image(self, img: Image.Image) -> Image.Image:
        """Auto-rotate image based on EXIF orientation."""
        try:
            if hasattr(img, "_getexif") and img._getexif() is not None:
                exif = img._getexif()
                if exif is not None:
                    orientation = exif.get(0x0112)
                    if orientation:
                        if orientation == 3:
                            img = img.rotate(180, expand=True)
                        elif orientation == 6:
                            img = img.rotate(270, expand=True)
                        elif orientation == 8:
                            img = img.rotate(90, expand=True)
        except Exception as e:
            print(f"Error auto-rotating image: {e}")

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

    async def delete_image_files(self, photo_data: dict):
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
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")

    @staticmethod
    def get_image_url(
        photo_data: dict, size: str = "medium", base_url: str = ""
    ) -> str:
        """Get the appropriate image URL for a given size."""
        variants = photo_data.get("variants", {})

        # Try to get the requested size
        if size in variants:
            path = variants[size]["path"]
            return f"{base_url}/{path}" if base_url else path

        # Fallback to available sizes in order of preference
        fallback_sizes = ["medium", "small", "large", "thumbnail", "xlarge"]
        for fallback_size in fallback_sizes:
            if fallback_size in variants:
                path = variants[fallback_size]["path"]
                return f"{base_url}/{path}" if base_url else path

        return ""

    @staticmethod
    def get_image_srcset(photo_data: dict, base_url: str = "") -> str:
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
