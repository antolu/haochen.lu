from __future__ import annotations

import asyncio
import io
from typing import Any

from PIL import ExifTags, Image

from app.core.exceptions import ImageProcessingError, UnsupportedFileTypeError


class ImageProcessor:
    """Service-layer image processing helpers used by unit tests.

    All methods are async and offload work to threads to avoid blocking.
    """

    async def extract_exif(self, image_path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._extract_exif_sync, image_path)

    def _extract_exif_sync(self, image_path: str) -> dict[str, Any]:
        data: dict[str, Any] = {}
        with Image.open(image_path) as img:
            data["width"], data["height"] = img.size

            exif = None
            try:
                exif_dict = img.getexif()
                exif = dict(exif_dict) if exif_dict else None
            except Exception:
                exif = None

            if exif:
                tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
                make = tag_map.get("Make")
                model = tag_map.get("Model")
                if make:
                    data["make"] = str(make)
                if model:
                    data["model"] = str(model)

                gps = tag_map.get("GPSInfo")
                if gps and isinstance(gps, dict):
                    lat, lat_ref = gps.get(2), gps.get(1)
                    lon, lon_ref = gps.get(4), gps.get(3)
                    lat_val = self._get_decimal_from_dms(lat, lat_ref)
                    lon_val = self._get_decimal_from_dms(lon, lon_ref)
                    if lat_val is not None and lon_val is not None:
                        data["gps_latitude"] = lat_val
                        data["gps_longitude"] = lon_val

        return data

    async def convert_to_webp(self, image_path: str, quality: int = 85) -> bytes:
        return await asyncio.to_thread(self._convert_to_webp_sync, image_path, quality)

    def _convert_to_webp_sync(self, image_path: str, quality: int) -> bytes:
        with Image.open(image_path) as img:
            if img.mode in ("P", "RGBA", "LA"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="WEBP", quality=quality)
            return out.getvalue()

    async def resize_image(
        self,
        image_path: str,
        max_width: int | None = None,
        max_height: int | None = None,
    ) -> bytes:
        return await asyncio.to_thread(
            self._resize_image_sync, image_path, max_width, max_height
        )

    def _resize_image_sync(
        self, image_path: str, max_width: int | None, max_height: int | None
    ) -> bytes:
        with Image.open(image_path) as img:
            w, h = img.size
            if not max_width and not max_height:
                max_width = w
                max_height = h
            if max_width and not max_height:
                ratio = max_width / w
                new_size = (int(w * ratio), int(h * ratio))
            elif max_height and not max_width:
                ratio = max_height / h
                new_size = (int(w * ratio), int(h * ratio))
            else:
                if not max_width or not max_height:
                    msg = (
                        "max_width and max_height must be provided for fixed dimensions"
                    )
                    raise ValueError(msg)
                ratio = min(max_width / w, max_height / h)
                new_size = (int(w * ratio), int(h * ratio))

            if img.mode in ("P", "RGBA", "LA"):
                img = img.convert("RGB")
            resized = img.resize(new_size, Image.Resampling.LANCZOS)
            out = io.BytesIO()
            resized.save(out, format="JPEG", quality=90)
            return out.getvalue()

    async def create_thumbnail(
        self, image_path: str, size: tuple[int, int] = (150, 150)
    ) -> bytes:
        return await asyncio.to_thread(self._create_thumbnail_sync, image_path, size)

    def _create_thumbnail_sync(self, image_path: str, size: tuple[int, int]) -> bytes:
        with Image.open(image_path) as img:
            if img.mode in ("P", "RGBA", "LA"):
                img = img.convert("RGB")
            target_w, target_h = size

            # Create cover-style thumbnail preserving aspect, then center-crop
            img_ratio = img.width / img.height
            target_ratio = target_w / target_h
            if img_ratio > target_ratio:
                # too wide
                new_height = target_h
                new_width = int(target_h * img_ratio)
            else:
                new_width = target_w
                new_height = int(target_w / img_ratio)
            resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

            left = (new_width - target_w) // 2
            top = (new_height - target_h) // 2
            right = left + target_w
            bottom = top + target_h
            cropped = resized.crop((left, top, right, bottom))

            out = io.BytesIO()
            cropped.save(out, format="JPEG", quality=85)
            return out.getvalue()

    async def optimize_image(self, image_path: str, quality: int = 75) -> bytes:
        return await asyncio.to_thread(self._optimize_image_sync, image_path, quality)

    def _optimize_image_sync(self, image_path: str, quality: int) -> bytes:
        with Image.open(image_path) as img:
            if img.mode in ("P", "RGBA", "LA"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=quality, optimize=True)
            return out.getvalue()

    async def extract_gps_data(self, image_path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._extract_gps_sync, image_path)

    def _extract_gps_sync(self, image_path: str) -> dict[str, Any]:
        data: dict[str, Any] = {}
        with Image.open(image_path) as img:
            try:
                exif_dict = img.getexif()
                exif = dict(exif_dict) if exif_dict else None
            except Exception:
                exif = None
            if exif:
                tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
                gps = tag_map.get("GPSInfo")
                if gps and isinstance(gps, dict):
                    lat, lat_ref = gps.get(2), gps.get(1)
                    lon, lon_ref = gps.get(4), gps.get(3)
                    lat_val = self._get_decimal_from_dms(lat, lat_ref)
                    lon_val = self._get_decimal_from_dms(lon, lon_ref)
                    if lat_val is not None:
                        data["latitude"] = lat_val
                    if lon_val is not None:
                        data["longitude"] = lon_val
                    if lat_ref:
                        data["latitude_ref"] = lat_ref
                    if lon_ref:
                        data["longitude_ref"] = lon_ref
        return data

    async def extract_camera_metadata(self, image_path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._extract_camera_sync, image_path)

    def _extract_camera_sync(self, image_path: str) -> dict[str, Any]:
        meta: dict[str, Any] = {}
        with Image.open(image_path) as img:
            try:
                exif_dict = img.getexif()
                exif = dict(exif_dict) if exif_dict else None
            except Exception:
                exif = None
            if exif:
                tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
                if tag_map.get("Make"):
                    meta["make"] = str(tag_map["Make"]).strip()
                if tag_map.get("Model"):
                    meta["model"] = str(tag_map["Model"]).strip()
                if tag_map.get("LensModel"):
                    meta["lens"] = str(tag_map["LensModel"]).strip()
        return meta

    async def extract_shooting_parameters(self, image_path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._extract_params_sync, image_path)

    def _extract_params_sync(self, image_path: str) -> dict[str, Any]:
        params: dict[str, Any] = {}
        with Image.open(image_path) as img:
            try:
                exif_dict = img.getexif()
                exif = dict(exif_dict) if exif_dict else None
            except Exception:
                exif = None
            if exif:
                tag_map = {ExifTags.TAGS.get(k, k): v for k, v in exif.items()}
                # Aperture (FNumber)
                fnum = tag_map.get("FNumber")
                if fnum and hasattr(fnum, "numerator") and hasattr(fnum, "denominator"):
                    params["aperture"] = float(fnum.numerator / fnum.denominator)
                elif isinstance(fnum, (int, float)):
                    params["aperture"] = float(fnum)

                # ExposureTime
                exp = tag_map.get("ExposureTime")
                if exp and hasattr(exp, "numerator") and hasattr(exp, "denominator"):
                    num = exp.numerator
                    den = exp.denominator
                    params["shutter_speed"] = f"{num}/{den}" if num != 1 else f"1/{den}"

                # ISO
                iso = tag_map.get("ISOSpeedRatings")
                if iso:
                    params["iso"] = int(iso) if isinstance(iso, (int, float)) else iso

                # FocalLength
                fl = tag_map.get("FocalLength")
                if fl and hasattr(fl, "numerator") and hasattr(fl, "denominator"):
                    params["focal_length"] = int(fl.numerator / fl.denominator)
        return params

    async def validate_image_format(self, mime_type: str) -> bool:
        allowed = {"image/jpeg", "image/png", "image/webp"}
        if mime_type not in allowed:
            msg = f"Unsupported format: {mime_type}"
            raise UnsupportedFileTypeError(msg)
        return True

    async def validate_image_size(self, size_bytes: int, max_size: int) -> bool:
        if size_bytes > max_size:
            msg = "File too large"
            raise ImageProcessingError(msg)
        return True

    async def sanitize_metadata(
        self,
        image_path: str,
        *,
        remove_gps: bool = True,
        remove_personal: bool = True,
    ) -> bytes:
        # Simple sanitization: re-save without EXIF
        return await asyncio.to_thread(self._sanitize_sync, image_path)

    def _sanitize_sync(self, image_path: str) -> bytes:
        with Image.open(image_path) as img:
            if img.mode in ("P", "RGBA", "LA"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=90)
            return out.getvalue()

    def _get_decimal_from_dms(self, dms, ref) -> float | None:
        try:
            if not dms or not ref:
                return None
            deg = (
                float(dms[0])
                if not hasattr(dms[0], "numerator")
                else dms[0].numerator / dms[0].denominator
            )
            minutes = (
                float(dms[1])
                if not hasattr(dms[1], "numerator")
                else dms[1].numerator / dms[1].denominator
            )
            seconds = (
                float(dms[2])
                if not hasattr(dms[2], "numerator")
                else dms[2].numerator / dms[2].denominator
            )
            decimal = deg + (minutes / 60.0) + (seconds / 3600.0)
            if ref in ["S", "W"]:
                decimal = -decimal
        except Exception:
            return None
        else:
            return decimal
