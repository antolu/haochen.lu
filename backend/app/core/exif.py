from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import piexif  # type: ignore[import-untyped, import-not-found, unused-ignore]

from app.services.location_service import location_service

logger = logging.getLogger(__name__)


def dms_to_decimal(dms_tuple: tuple | None) -> float | None:
    """Convert EXIF degrees/minutes/seconds tuple to decimal degrees."""
    if not dms_tuple or len(dms_tuple) != 3:
        return None
    degrees = float(dms_tuple[0][0] / dms_tuple[0][1]) if dms_tuple[0][1] != 0 else 0
    minutes = float(dms_tuple[1][0] / dms_tuple[1][1]) if dms_tuple[1][1] != 0 else 0
    seconds = float(dms_tuple[2][0] / dms_tuple[2][1]) if dms_tuple[2][1] != 0 else 0
    return degrees + (minutes / 60.0) + (seconds / 3600.0)


def _decode_ref(ref: bytes | str) -> str:
    return ref.decode().strip() if isinstance(ref, bytes) else str(ref).strip()


def parse_enhanced_gps(gps_info: dict) -> dict[str, Any]:
    """Parse GPS coordinates and altitude from a piexif GPS IFD dict."""
    gps_data: dict[str, Any] = {}

    if (
        piexif.GPSIFD.GPSLatitude in gps_info
        and piexif.GPSIFD.GPSLatitudeRef in gps_info
    ):
        lat_decimal = dms_to_decimal(gps_info[piexif.GPSIFD.GPSLatitude])
        if lat_decimal is not None:
            lat_ref = _decode_ref(gps_info[piexif.GPSIFD.GPSLatitudeRef])
            gps_data["location_lat"] = (
                -lat_decimal if lat_ref in ("S", "s") else lat_decimal
            )

    if (
        piexif.GPSIFD.GPSLongitude in gps_info
        and piexif.GPSIFD.GPSLongitudeRef in gps_info
    ):
        lon_decimal = dms_to_decimal(gps_info[piexif.GPSIFD.GPSLongitude])
        if lon_decimal is not None:
            lon_ref = _decode_ref(gps_info[piexif.GPSIFD.GPSLongitudeRef])
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


def extract_enhanced_gps_data(gps_info: dict) -> dict[str, Any]:
    """Extract GPS coordinates and altitude, returning {} on any parse error."""
    try:
        return parse_enhanced_gps(gps_info)
    except Exception:
        logger.exception("Error extracting enhanced GPS data")
        return {}


async def extract_comprehensive_exif(exif_dict: dict) -> dict[str, Any]:
    """Extract camera, exposure, lens, and GPS/location data from a piexif dict."""
    data: dict[str, Any] = {}

    if "0th" in exif_dict:
        ifd = exif_dict["0th"]

        if piexif.ImageIFD.Make in ifd:
            data["camera_make"] = ifd[piexif.ImageIFD.Make].decode().strip()
        if piexif.ImageIFD.Model in ifd:
            data["camera_model"] = ifd[piexif.ImageIFD.Model].decode().strip()

        if piexif.ImageIFD.DateTime in ifd:
            try:
                dt_str = ifd[piexif.ImageIFD.DateTime].decode()
                data["date_taken"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            except (ValueError, AttributeError):
                pass

    if "Exif" in exif_dict:
        ifd = exif_dict["Exif"]

        if piexif.ExifIFD.DateTimeOriginal in ifd:
            try:
                dt_str = ifd[piexif.ExifIFD.DateTimeOriginal].decode()
                data["date_taken"] = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            except (ValueError, AttributeError):
                pass

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

        if piexif.ExifIFD.LensModel in ifd:
            data["lens"] = ifd[piexif.ExifIFD.LensModel].decode().strip()

        if piexif.ExifIFD.OffsetTimeOriginal in ifd:
            try:
                timezone_offset = (
                    ifd[piexif.ExifIFD.OffsetTimeOriginal].decode().strip()
                )
                data["timezone"] = timezone_offset
            except (ValueError, AttributeError):
                pass

    if "GPS" in exif_dict:
        gps_data = extract_enhanced_gps_data(exif_dict["GPS"])
        data.update(gps_data)

        if "location_lat" in gps_data and "location_lon" in gps_data:
            location_info = await location_service.reverse_geocode(
                gps_data["location_lat"], gps_data["location_lon"]
            )
            if location_info:
                data["location_name"] = location_info.location_name
                data["location_address"] = location_info.location_address

    return data
