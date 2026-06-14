from __future__ import annotations

import piexif  # type: ignore[import-untyped, import-not-found, unused-ignore]
import pytest

from app.core.exif import dms_to_decimal, parse_enhanced_gps


def test_dms_to_decimal_converts_correctly() -> None:
    # 37 deg 46 min 29.74 sec ~= 37.7749
    dms = ((37, 1), (46, 1), (2974, 100))
    result = dms_to_decimal(dms)
    assert result is not None
    assert abs(result - 37.7749) < 0.001


def test_dms_to_decimal_handles_none() -> None:
    assert dms_to_decimal(None) is None


def test_dms_to_decimal_handles_wrong_length() -> None:
    assert dms_to_decimal(((1, 1), (2, 1))) is None


def test_parse_enhanced_gps_extracts_lat_lon() -> None:
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (2974, 100)),
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLongitude: ((122, 1), (25, 1), (979, 100)),
        piexif.GPSIFD.GPSLongitudeRef: b"W",
    }
    result = parse_enhanced_gps(gps_info)
    assert abs(result["location_lat"] - 37.7749) < 0.001
    assert abs(result["location_lon"] - (-122.4194)) < 0.001


def test_parse_enhanced_gps_handles_southern_western_refs() -> None:
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((10, 1), (0, 1), (0, 1)),
        piexif.GPSIFD.GPSLatitudeRef: b"S",
        piexif.GPSIFD.GPSLongitude: ((20, 1), (0, 1), (0, 1)),
        piexif.GPSIFD.GPSLongitudeRef: b"W",
    }
    result = parse_enhanced_gps(gps_info)
    assert result["location_lat"] == pytest.approx(-10.0)
    assert result["location_lon"] == pytest.approx(-20.0)


def test_parse_enhanced_gps_extracts_altitude() -> None:
    gps_info = {
        piexif.GPSIFD.GPSAltitude: (1500, 1),
        piexif.GPSIFD.GPSAltitudeRef: 0,
    }
    result = parse_enhanced_gps(gps_info)
    assert result["altitude"] == pytest.approx(1500.0)


def test_parse_enhanced_gps_negative_altitude_below_sea_level() -> None:
    gps_info = {
        piexif.GPSIFD.GPSAltitude: (100, 1),
        piexif.GPSIFD.GPSAltitudeRef: 1,
    }
    result = parse_enhanced_gps(gps_info)
    assert result["altitude"] == pytest.approx(-100.0)


def test_parse_enhanced_gps_empty_dict_returns_empty() -> None:
    assert parse_enhanced_gps({}) == {}
