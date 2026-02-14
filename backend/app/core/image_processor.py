from __future__ import annotations

import asyncio
import contextlib
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
from app.core.location_service import location_service


class ImageProcessor:
    def __init__(self, upload_dir: str, compressed_dir: str):
        self.upload_dir = Path(upload_dir).resolve()
        self.compressed_dir = Path(compressed_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)
        self.compressed_dir.mkdir(exist_ok=True, parents=True)

    async def extract_exif_data(self, image_path: str) -> dict[str, Any]:
        """Extract comprehensive EXIF data from image including timezone and GPS."""
        exif_data: dict[str, Any] = {}

        try:
            with Image.open(image_path) as img:
                # Get basic image info
                exif_data["width"] = img.width
                exif_data["height"] = img.height

                # Try piexif for more comprehensive EXIF data
                try:
                    exif_dict = piexif.load(image_path)
                    comprehensive_data = await self._extract_comprehensive_exif(
                        exif_dict
                    )
                    exif_data.update(comprehensive_data)
                except Exception:
                    # Fallback to PIL's EXIF extraction
                    if hasattr(img, "_getexif") and img._getexif() is not None:
                        exif = img._getexif()
                        exif_data.update(self._extract_basic_exif(exif))

        except Exception as e:
            print(f"Error extracting EXIF data: {e}")

        return exif_data

    async def _extract_comprehensive_exif(self, exif_dict: dict) -> dict[str, Any]:
        """Extract comprehensive EXIF data using piexif."""
        data: dict[str, Any] = {}

        # Extract from 0th IFD (main image)
        if "0th" in exif_dict:
            ifd = exif_dict["0th"]

            # Camera make and model
            if piexif.ImageIFD.Make in ifd:
                data["camera_make"] = ifd[piexif.ImageIFD.Make].decode().strip()
            if piexif.ImageIFD.Model in ifd:
                data["camera_model"] = ifd[piexif.ImageIFD.Model].decode().strip()

            # Date and time
            if piexif.ImageIFD.DateTime in ifd:
                try:
                    dt_str = ifd[piexif.ImageIFD.DateTime].decode()
                    data["date_taken"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
                except (ValueError, AttributeError):
                    pass

        # Extract from Exif IFD (detailed camera settings)
        if "Exif" in exif_dict:
            ifd = exif_dict["Exif"]

            # Original date (often more accurate)
            if piexif.ExifIFD.DateTimeOriginal in ifd:
                try:
                    dt_str = ifd[piexif.ExifIFD.DateTimeOriginal].decode()
                    data["date_taken"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
                except (ValueError, AttributeError):
                    pass

            # Camera settings
            if piexif.ExifIFD.ISOSpeedRatings in ifd:
                data["iso"] = ifd[piexif.ExifIFD.ISOSpeedRatings]

            if piexif.ExifIFD.FNumber in ifd:
                f_num = ifd[piexif.ExifIFD.FNumber]
                if isinstance(f_num, tuple) and len(f_num) == 2 and f_num[1] != 0:
                    data["aperture"] = float(f_num[0] / f_num[1])

            if piexif.ExifIFD.ExposureTime in ifd:
                exp_time = ifd[piexif.ExifIFD.ExposureTime]
                if isinstance(exp_time, tuple) and len(exp_time) == 2:
                    if exp_time[0] == 1:
                        data["shutter_speed"] = f"1/{exp_time[1]}"
                    else:
                        data["shutter_speed"] = f"{exp_time[0]}/{exp_time[1]}"

            if piexif.ExifIFD.FocalLength in ifd:
                focal = ifd[piexif.ExifIFD.FocalLength]
                if isinstance(focal, tuple) and len(focal) == 2 and focal[1] != 0:
                    data["focal_length"] = int(focal[0] / focal[1])

            # Lens information
            if piexif.ExifIFD.LensModel in ifd:
                data["lens"] = ifd[piexif.ExifIFD.LensModel].decode().strip()

            # Timezone information from SubSecTimeOriginal or OffsetTime
            timezone_offset = None
            if piexif.ExifIFD.OffsetTimeOriginal in ifd:
                try:
                    timezone_offset = (
                        ifd[piexif.ExifIFD.OffsetTimeOriginal].decode().strip()
                    )
                    data["timezone"] = timezone_offset
                except (ValueError, AttributeError):
                    pass

        # Extract GPS data
        if "GPS" in exif_dict:
            gps_data = self._extract_enhanced_gps_data(exif_dict["GPS"])
            data.update(gps_data)

            # Try to get location name if we have coordinates
            if "location_lat" in gps_data and "location_lon" in gps_data:
                location_info = await location_service.reverse_geocode(
                    gps_data["location_lat"], gps_data["location_lon"]
                )
                if location_info:
                    data["location_name"] = location_info.location_name
                    data["location_address"] = location_info.location_address

        return data

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

    def _extract_enhanced_gps_data(
        self, gps_info: dict[int | str, typing.Any]
    ) -> dict[str, typing.Any]:
        """Extract enhanced GPS coordinates and altitude from EXIF GPS info using piexif."""
        gps_data = {}

        try:

            def convert_dms_to_decimal(
                dms_tuple: tuple[tuple[int, int], tuple[int, int], tuple[int, int]]
                | None,
            ) -> float | None:
                """Convert DMS (degrees, minutes, seconds) tuple to decimal degrees."""
                if not dms_tuple or len(dms_tuple) != 3:
                    return None

                degrees = (
                    float(dms_tuple[0][0] / dms_tuple[0][1])
                    if dms_tuple[0][1] != 0
                    else 0
                )
                minutes = (
                    float(dms_tuple[1][0] / dms_tuple[1][1])
                    if dms_tuple[1][1] != 0
                    else 0
                )
                seconds = (
                    float(dms_tuple[2][0] / dms_tuple[2][1])
                    if dms_tuple[2][1] != 0
                    else 0
                )

                return degrees + (minutes / 60.0) + (seconds / 3600.0)

            # Extract latitude
            if (
                piexif.GPSIFD.GPSLatitude in gps_info
                and piexif.GPSIFD.GPSLatitudeRef in gps_info
            ):
                lat_dms = gps_info[piexif.GPSIFD.GPSLatitude]
                lat_ref = gps_info[piexif.GPSIFD.GPSLatitudeRef].decode()

                lat_decimal = convert_dms_to_decimal(lat_dms)
                if lat_decimal is not None:
                    if lat_ref in ["S", "s"]:
                        lat_decimal = -lat_decimal
                    gps_data["location_lat"] = lat_decimal

            # Extract longitude
            if (
                piexif.GPSIFD.GPSLongitude in gps_info
                and piexif.GPSIFD.GPSLongitudeRef in gps_info
            ):
                lon_dms = gps_info[piexif.GPSIFD.GPSLongitude]
                lon_ref = gps_info[piexif.GPSIFD.GPSLongitudeRef].decode()

                lon_decimal = convert_dms_to_decimal(lon_dms)
                if lon_decimal is not None:
                    if lon_ref in ["W", "w"]:
                        lon_decimal = -lon_decimal
                    gps_data["location_lon"] = lon_decimal

            # Extract altitude (optional)
            if piexif.GPSIFD.GPSAltitude in gps_info:
                alt_tuple = gps_info[piexif.GPSIFD.GPSAltitude]
                if alt_tuple and len(alt_tuple) == 2 and alt_tuple[1] != 0:
                    altitude = float(alt_tuple[0] / alt_tuple[1])

                    # Check altitude reference (0 = above sea level, 1 = below sea level)
                    if piexif.GPSIFD.GPSAltitudeRef in gps_info:
                        alt_ref = gps_info[piexif.GPSIFD.GPSAltitudeRef]
                        if alt_ref == 1:
                            altitude = -altitude

                    gps_data["altitude"] = altitude

        except Exception as e:
            print(f"Error extracting enhanced GPS data: {e}")

        return gps_data

    def _extract_gps_data(
        self, gps_info: dict[int | str, typing.Any]
    ) -> dict[str, typing.Any]:
        """Fallback GPS extraction for PIL-based EXIF."""
        gps_data = {}

        try:

            def get_decimal_from_dms(
                dms: tuple[float, float, float], ref: str
            ) -> float:
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

    def _generate_responsive_variants(
        self, original_path: Path, file_id: str
    ) -> dict[str, typing.Any]:
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
                        "path": f"/compressed/{webp_filename}",
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
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")

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
