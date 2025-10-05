from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import Callable
from contextlib import suppress
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO

import piexif  # type: ignore[import-not-found, unused-ignore]
import pyvips  # type: ignore[import-not-found]

from app.config import settings
from app.core.location_service import location_service
from app.core.progress import progress_manager
from app.core.runtime_settings import get_image_settings


class VipsImageProcessor:
    """High-performance image processor using libvips with AVIF/WebP/JPEG support."""

    def __init__(
        self,
        upload_dir: str,
        compressed_dir: str,
        progress_callback: Callable[[str, int], None] | None = None,
        *,
        upload_id: str | None = None,
    ):
        self.upload_dir = Path(upload_dir).resolve()
        self.compressed_dir = Path(compressed_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)
        self.compressed_dir.mkdir(exist_ok=True, parents=True)
        self.progress_callback = progress_callback
        self.upload_id = upload_id
        self._progress_task: asyncio.Task | None = None

        # Configure vips for better performance
        pyvips.cache_set_max(100)  # Set cache size
        pyvips.cache_set_max_mem(100 * 1024 * 1024)  # 100MB cache

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

    async def extract_exif_data(self, image_path: str) -> dict[str, Any]:
        """Extract comprehensive EXIF data from image including timezone and GPS."""
        self._update_progress("exif", 20)
        exif_data: dict[str, Any] = {}

        try:
            # Use pyvips to get basic image info quickly
            vips_image = pyvips.Image.new_from_file(image_path, access="sequential")
            exif_data["width"] = vips_image.width
            exif_data["height"] = vips_image.height

            self._update_progress("exif", 30)

            # Use piexif for detailed EXIF extraction (more reliable than vips)
            try:
                exif_dict = piexif.load(image_path)
                comprehensive_data = await self._extract_comprehensive_exif(exif_dict)
                exif_data.update(comprehensive_data)
            except Exception:
                # Fallback to vips EXIF extraction
                if vips_image.get_typeof("exif") != 0:
                    vips_exif = vips_image.get("exif")
                    fallback_data = self._extract_vips_exif(vips_exif)
                    exif_data.update(fallback_data)

            self._update_progress("exif", 40)

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
                if isinstance(f_num, tuple) and len(f_num) == 2:
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
                if isinstance(focal, tuple) and len(focal) == 2:
                    data["focal_length"] = int(focal[0] / focal[1])

            # Lens information
            if piexif.ExifIFD.LensModel in ifd:
                data["lens"] = ifd[piexif.ExifIFD.LensModel].decode().strip()

            # Timezone information
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
                    data["location_name"] = location_info["location_name"]
                    data["location_address"] = location_info["location_address"]

        return data

    def _extract_vips_exif(self, exif_bytes: bytes) -> dict[str, Any]:
        """Fallback EXIF extraction using vips data."""
        # This is a simplified fallback - in practice, you'd parse the EXIF bytes
        return {}

    def _extract_enhanced_gps_data(self, gps_info: dict) -> dict:
        """Extract enhanced GPS coordinates and altitude from EXIF GPS info using piexif."""
        gps_data = {}

        try:

            def convert_dms_to_decimal(dms_tuple):
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

    def _generate_responsive_variants(self, original_path: Path, file_id: str) -> dict:
        """Generate multiple responsive image sizes in AVIF, WebP, and JPEG formats."""
        variants = {}

        try:
            # Load image with vips for efficient processing
            vips_image = pyvips.Image.new_from_file(
                str(original_path), access="sequential"
            )

            # Auto-rotate based on EXIF orientation
            vips_image = vips_image.autorot()

            # Convert colorspace if necessary (vips handles this automatically)
            if vips_image.interpretation != "srgb":
                vips_image = vips_image.colourspace("srgb")

            # Get original dimensions
            original_width, original_height = vips_image.width, vips_image.height

            current_progress: float = 60.0
            runtime = get_image_settings()
            total_variants = len(runtime.responsive_sizes)
            progress_per_variant: float = (
                30.0 / total_variants if total_variants else 30.0
            )

            # Generate each responsive size
            for _i, (size_name, target_size) in enumerate(
                runtime.responsive_sizes.items()
            ):
                # Skip if target size is larger than original
                if target_size > max(original_width, original_height):
                    continue

                # Create resized image
                resized_img = self._resize_image_vips(vips_image, target_size)

                # Generate all three formats for this size
                variant_formats = {}

                # 1. AVIF (highest compression, best quality)
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
                    variant_formats["avif"] = {
                        "path": f"/compressed/{avif_filename}",
                        "filename": avif_filename,
                        "width": resized_img.width,
                        "height": resized_img.height,
                        "size_bytes": avif_path.stat().st_size,
                        "format": "avif",
                        "mime_type": "image/avif",
                    }
                except Exception as e:
                    print(f"Error generating AVIF for {size_name}: {e}")

                # 2. WebP (good balance)
                webp_filename = f"{file_id}_{size_name}.webp"
                webp_path = self.compressed_dir / webp_filename
                webp_quality = runtime.quality_settings.get(
                    size_name, settings.webp_quality
                )

                try:
                    resized_img.webpsave(
                        str(webp_path),
                        Q=webp_quality,
                        effort=6,  # High effort for better compression
                    )
                    variant_formats["webp"] = {
                        "path": f"/compressed/{webp_filename}",
                        "filename": webp_filename,
                        "width": resized_img.width,
                        "height": resized_img.height,
                        "size_bytes": webp_path.stat().st_size,
                        "format": "webp",
                        "mime_type": "image/webp",
                    }
                except Exception as e:
                    print(f"Error generating WebP for {size_name}: {e}")

                # 3. JPEG (universal compatibility)
                jpeg_filename = f"{file_id}_{size_name}.jpg"
                jpeg_path = self.compressed_dir / jpeg_filename
                jpeg_quality = min(webp_quality + 5, 95)  # Slightly higher quality

                try:
                    resized_img.jpegsave(
                        str(jpeg_path),
                        Q=jpeg_quality,
                        optimize_coding=True,
                        interlace=True,
                    )
                    variant_formats["jpeg"] = {
                        "path": f"/compressed/{jpeg_filename}",
                        "filename": jpeg_filename,
                        "width": resized_img.width,
                        "height": resized_img.height,
                        "size_bytes": jpeg_path.stat().st_size,
                        "format": "jpeg",
                        "mime_type": "image/jpeg",
                    }
                except Exception as e:
                    print(f"Error generating JPEG for {size_name}: {e}")

                variants[size_name] = variant_formats

                # Update progress
                current_progress += progress_per_variant
                self._update_progress("processing", int(current_progress))

        except Exception as e:
            print(f"Error generating responsive variants: {e}")
            raise

        return variants

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
        runtime = get_image_settings()
        base_quality = runtime.quality_settings.get(size_name, settings.webp_quality)

        # AVIF can achieve better compression, so we can use slightly lower quality,
        # allow overrides via settings
        avif_quality_offset = getattr(
            runtime, "avif_quality_base_offset", settings.avif_quality_base_offset
        )
        avif_quality_floor = getattr(
            runtime, "avif_quality_floor", settings.avif_quality_floor
        )
        try:
            offset = int(avif_quality_offset)
        except Exception:
            offset = -10
        try:
            floor = int(avif_quality_floor)
        except Exception:
            floor = 50
        avif_quality = max(base_quality + offset, floor)

        # Adjust effort based on size (higher effort for smaller sizes)
        effort_map = {
            "thumbnail": 8,  # Maximum effort for thumbnails
            "small": 7,
            "medium": 6,
            "large": 5,
            "xlarge": 4,  # Lower effort for large files (speed vs quality)
        }

        avif_effort_default = getattr(
            runtime, "avif_effort_default", settings.avif_effort_default
        )
        return {
            "quality": int(avif_quality),
            "effort": int(effort_map.get(size_name, avif_effort_default)),
        }

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
                except Exception as e:
                    print(f"Error deleting file {file_path}: {e}")

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


# Global instance (will replace the old image_processor)
vips_image_processor = VipsImageProcessor(settings.upload_dir, settings.compressed_dir)
