from __future__ import annotations

import asyncio
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
                            try:
                                exif_data["date_taken"] = datetime.strptime(
                                    str(value), "%Y:%m:%d %H:%M:%S"
                                )
                            except (ValueError, TypeError):
                                pass

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
        """Process uploaded image: save original, create WebP, extract EXIF."""

        # Generate unique filename
        file_id = str(uuid.uuid4())
        file_ext = Path(filename).suffix.lower()
        original_filename = f"{file_id}{file_ext}"
        webp_filename = f"{file_id}.webp"
        thumbnail_filename = f"{file_id}_thumb.webp"

        # File paths
        original_path = self.upload_dir / original_filename
        webp_path = self.compressed_dir / webp_filename
        thumbnail_path = self.compressed_dir / thumbnail_filename

        # Save original file
        with open(original_path, "wb") as buffer:
            content = await asyncio.to_thread(file.read)
            buffer.write(content)

        # Extract EXIF data
        exif_data = await asyncio.to_thread(self.extract_exif_data, str(original_path))

        # Process image in thread
        await asyncio.to_thread(
            self._process_image_sync, original_path, webp_path, thumbnail_path
        )

        # Get file size
        file_size = original_path.stat().st_size

        return {
            "filename": original_filename,
            "original_path": str(original_path),
            "webp_path": str(webp_path),
            "thumbnail_path": str(thumbnail_path),
            "file_size": file_size,
            **exif_data,
        }

    def _process_image_sync(
        self, original_path: Path, webp_path: Path, thumbnail_path: Path
    ):
        """Synchronous image processing operations."""
        try:
            with Image.open(original_path) as img:
                # Auto-rotate based on EXIF orientation
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

                # Convert to RGB if necessary
                if img.mode in ("RGBA", "LA", "P"):
                    img = img.convert("RGB")

                # Create WebP version
                img.save(
                    webp_path,
                    format="WEBP",
                    quality=settings.webp_quality,
                    method=6,  # Best compression
                )

                # Create thumbnail
                thumbnail = img.copy()
                thumbnail.thumbnail(
                    (settings.thumbnail_size, settings.thumbnail_size),
                    Image.Resampling.LANCZOS,
                )
                thumbnail.save(thumbnail_path, format="WEBP", quality=80, method=6)

        except Exception as e:
            print(f"Error processing image: {e}")
            raise

    async def delete_image_files(self, photo_data: dict):
        """Delete all files associated with a photo."""
        files_to_delete = [
            photo_data.get("original_path"),
            photo_data.get("webp_path"),
            photo_data.get("thumbnail_path"),
        ]

        for file_path in files_to_delete:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")


# Global instance
image_processor = ImageProcessor(settings.upload_dir, settings.compressed_dir)
