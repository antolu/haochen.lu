from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import Callable
from contextlib import suppress
from datetime import datetime
from pathlib import Path
from typing import Any, BinaryIO

import piexif  # type: ignore[import-untyped, import-not-found, unused-ignore]
import pyvips  # type: ignore[import-untyped, import-not-found]

from app.config import settings
from app.core.location_service import location_service
from app.core.progress import progress_manager
from app.core.runtime_settings import get_image_settings

# Configure pyvips global cache once at module level
pyvips.cache_set_max(100)  # Set cache size
pyvips.cache_set_max_mem(100 * 1024 * 1024)  # 100MB cache


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
            comprehensive_data = await self._extract_comprehensive_exif(exif_dict)
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
                    data["location_name"] = location_info.location_name
                    data["location_address"] = location_info.location_address

        return data

    def _extract_vips_exif(self, exif_bytes: bytes) -> dict[str, Any]:
        """Fallback EXIF extraction using vips data."""
        # This is a simplified fallback - in practice, you'd parse the EXIF bytes
        return {}

    @staticmethod
    def _dms_to_decimal(dms_tuple: tuple | None) -> float | None:
        if not dms_tuple or len(dms_tuple) != 3:
            return None
        degrees = (
            float(dms_tuple[0][0] / dms_tuple[0][1]) if dms_tuple[0][1] != 0 else 0
        )
        minutes = (
            float(dms_tuple[1][0] / dms_tuple[1][1]) if dms_tuple[1][1] != 0 else 0
        )
        seconds = (
            float(dms_tuple[2][0] / dms_tuple[2][1]) if dms_tuple[2][1] != 0 else 0
        )
        return degrees + (minutes / 60.0) + (seconds / 3600.0)

    @staticmethod
    def _decode_ref(ref: bytes | str) -> str:
        return ref.decode().strip() if isinstance(ref, bytes) else str(ref).strip()

    def _parse_enhanced_gps(self, gps_info: dict) -> dict:
        gps_data: dict[str, Any] = {}

        if (
            piexif.GPSIFD.GPSLatitude in gps_info
            and piexif.GPSIFD.GPSLatitudeRef in gps_info
        ):
            lat_decimal = self._dms_to_decimal(gps_info[piexif.GPSIFD.GPSLatitude])
            if lat_decimal is not None:
                lat_ref = self._decode_ref(gps_info[piexif.GPSIFD.GPSLatitudeRef])
                gps_data["location_lat"] = (
                    -lat_decimal if lat_ref in ("S", "s") else lat_decimal
                )

        if (
            piexif.GPSIFD.GPSLongitude in gps_info
            and piexif.GPSIFD.GPSLongitudeRef in gps_info
        ):
            lon_decimal = self._dms_to_decimal(gps_info[piexif.GPSIFD.GPSLongitude])
            if lon_decimal is not None:
                lon_ref = self._decode_ref(gps_info[piexif.GPSIFD.GPSLongitudeRef])
                gps_data["location_lon"] = (
                    -lon_decimal if lon_ref in ("W", "w") else lon_decimal
                )

        if piexif.GPSIFD.GPSAltitude in gps_info:
            alt_tuple = gps_info[piexif.GPSIFD.GPSAltitude]
            if alt_tuple and len(alt_tuple) == 2 and alt_tuple[1] != 0:
                altitude = float(alt_tuple[0] / alt_tuple[1])
                if (
                    piexif.GPSIFD.GPSAltitudeRef in gps_info
                    and gps_info[piexif.GPSIFD.GPSAltitudeRef] == 1
                ):
                    altitude = -altitude
                gps_data["altitude"] = altitude

        return gps_data

    def _extract_enhanced_gps_data(self, gps_info: dict) -> dict:
        """Extract enhanced GPS coordinates and altitude from EXIF GPS info using piexif."""
        try:
            return self._parse_enhanced_gps(gps_info)
        except Exception as e:
            print(f"Error extracting enhanced GPS data: {e}")
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
        except Exception as e:
            print(f"Error generating AVIF for {size_name}: {e}")
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
        except Exception as e:
            print(f"Error generating WebP for {size_name}: {e}")
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
        except Exception as e:
            print(f"Error generating JPEG for {size_name}: {e}")
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
        runtime,
    ) -> dict:
        resized_img = self._resize_image_vips(vips_image, target_size)
        variant_formats = {}

        avif = self._save_avif_variant(resized_img, file_id, size_name)
        if avif is not None:
            variant_formats["avif"] = avif

        webp_quality = runtime.quality_settings.get(size_name, settings.webp_quality)
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
        runtime = get_image_settings()
        total_variants = len(runtime.responsive_sizes)
        progress_per_variant: float = 30.0 / total_variants if total_variants else 30.0
        current_progress: float = 60.0

        variants = {}
        for size_name, target_size in runtime.responsive_sizes.items():
            if target_size > max(original_width, original_height):
                continue
            variants[size_name] = self._generate_variant_formats(
                vips_image, file_id, size_name, target_size, runtime
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
        except Exception as e:
            print(f"Error generating responsive variants: {e}")
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
