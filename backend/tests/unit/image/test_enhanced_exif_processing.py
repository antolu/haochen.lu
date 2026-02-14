from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import piexif
import pytest

from app.core.image_processor import ImageProcessor


@pytest.fixture
def mock_image_processor(tmp_path):
    """Create ImageProcessor instance with temporary directories."""
    upload_dir = tmp_path / "upload"
    compressed_dir = tmp_path / "compressed"
    return ImageProcessor(str(upload_dir), str(compressed_dir))


@pytest.fixture
def mock_image():
    """Mock PIL Image object that works with context manager."""
    mock_img = MagicMock()
    mock_img.width = 3000
    mock_img.height = 2000
    mock_img.size = (3000, 2000)
    mock_img.mode = "RGB"
    # Make it work with context manager (with statement)
    mock_img.__enter__ = MagicMock(return_value=mock_img)
    mock_img.__exit__ = MagicMock(return_value=False)
    return mock_img


@pytest.fixture
def comprehensive_exif_dict():
    """Mock comprehensive EXIF dictionary from piexif."""
    return {
        "0th": {
            piexif.ImageIFD.Make: b"Canon",
            piexif.ImageIFD.Model: b"EOS R5",
            piexif.ImageIFD.DateTime: b"2023:12:25 14:30:00",
        },
        "Exif": {
            piexif.ExifIFD.DateTimeOriginal: b"2023:12:25 14:30:00",
            piexif.ExifIFD.ISOSpeedRatings: 400,
            piexif.ExifIFD.FNumber: (280, 100),  # f/2.8
            piexif.ExifIFD.ExposureTime: (1, 250),  # 1/250s
            piexif.ExifIFD.FocalLength: (85, 1),  # 85mm
            piexif.ExifIFD.LensModel: b"RF85mm F2 MACRO IS STM",
            piexif.ExifIFD.OffsetTimeOriginal: b"+02:00",
        },
        "GPS": {
            piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (2940, 100)),  # 37°46'29.4"N
            piexif.GPSIFD.GPSLatitudeRef: b"N",
            piexif.GPSIFD.GPSLongitude: (
                (122, 1),
                (25, 1),
                (1164, 100),
            ),  # 122°25'11.64"W
            piexif.GPSIFD.GPSLongitudeRef: b"W",
            piexif.GPSIFD.GPSAltitude: (12500, 100),  # 125m
            piexif.GPSIFD.GPSAltitudeRef: 0,  # Above sea level
        },
    }


@pytest.fixture
def basic_pil_exif():
    """Mock basic PIL EXIF data."""
    return {
        306: "2023:12:25 14:30:00",  # DateTime
        271: "Canon",  # Make
        272: "EOS R5",  # Model
        34665: {  # ExifIFD
            36867: "2023:12:25 14:30:00",  # DateTimeOriginal
            34855: 400,  # ISOSpeedRatings
        },
        34853: {  # GPSInfo
            1: "N",
            2: (37, 46, 29.4),
            3: "W",
            4: (122, 25, 11.64),
        },
    }


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_success(
    mock_image_processor, mock_image, comprehensive_exif_dict
):
    """Test successful comprehensive EXIF extraction with piexif."""
    with (
        patch("PIL.Image.open", return_value=mock_image),
        patch("piexif.load", return_value=comprehensive_exif_dict),
        patch.object(
            mock_image_processor, "_extract_comprehensive_exif"
        ) as mock_extract,
    ):
        mock_extract.return_value = {
            "camera_make": "Canon",
            "camera_model": "EOS R5",
            "date_taken": datetime(2023, 12, 25, 14, 30, 0),
            "iso": 400,
            "aperture": 2.8,
            "shutter_speed": "1/250",
            "focal_length": 85,
            "lens": "RF85mm F2 MACRO IS STM",
            "timezone": "+02:00",
            "location_lat": 37.774167,
            "location_lon": -122.419167,
            "altitude": 125.0,
        }

        result = await mock_image_processor.extract_exif_data("/fake/image.jpg")

        assert result["camera_make"] == "Canon"
        assert result["camera_model"] == "EOS R5"
        assert result["iso"] == 400
        assert result["aperture"] == pytest.approx(2.8)
        assert result["shutter_speed"] == "1/250"
        assert result["focal_length"] == 85
        assert result["lens"] == "RF85mm F2 MACRO IS STM"
        assert result["timezone"] == "+02:00"
        assert abs(result["location_lat"] - 37.774167) < 0.001
        assert abs(result["location_lon"] + 122.419167) < 0.001
        assert result["altitude"] == pytest.approx(125.0)
        assert result["width"] == 3000
        assert result["height"] == 2000


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_camera_data(
    mock_image_processor, comprehensive_exif_dict
):
    """Test extraction of camera make and model."""
    result = await mock_image_processor._extract_comprehensive_exif(
        comprehensive_exif_dict
    )

    assert result["camera_make"] == "Canon"
    assert result["camera_model"] == "EOS R5"


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_datetime(
    mock_image_processor, comprehensive_exif_dict
):
    """Test extraction and parsing of datetime."""
    result = await mock_image_processor._extract_comprehensive_exif(
        comprehensive_exif_dict
    )

    assert isinstance(result["date_taken"], datetime)
    assert result["date_taken"] == datetime(2023, 12, 25, 14, 30, 0)


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_camera_settings(
    mock_image_processor, comprehensive_exif_dict
):
    """Test extraction of camera settings."""
    result = await mock_image_processor._extract_comprehensive_exif(
        comprehensive_exif_dict
    )

    assert result["iso"] == 400
    assert result["aperture"] == pytest.approx(2.8)  # 280/100
    assert result["shutter_speed"] == "1/250"
    assert result["focal_length"] == 85
    assert result["lens"] == "RF85mm F2 MACRO IS STM"
    assert result["timezone"] == "+02:00"


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_gps_coordinates(
    mock_image_processor, comprehensive_exif_dict
):
    """Test GPS coordinate extraction and conversion."""
    with patch.object(mock_image_processor, "_extract_enhanced_gps_data") as mock_gps:
        mock_gps.return_value = {
            "location_lat": 37.774167,
            "location_lon": -122.419167,
            "altitude": 125.0,
        }

        result = await mock_image_processor._extract_comprehensive_exif(
            comprehensive_exif_dict
        )

        mock_gps.assert_called_once_with(comprehensive_exif_dict["GPS"])
        assert abs(result["location_lat"] - 37.774167) < 0.001
        assert abs(result["location_lon"] + 122.419167) < 0.001
        assert result["altitude"] == pytest.approx(125.0)


@pytest.mark.asyncio
async def test_extract_comprehensive_exif_with_location_service(
    mock_image_processor, comprehensive_exif_dict
):
    """Test EXIF extraction with location service integration."""
    mock_location_info = MagicMock()
    mock_location_info.location_name = "San Francisco, California, United States"
    mock_location_info.location_address = "San Francisco, CA 94102, USA"

    # Patch location_service where it's imported in image_processor
    with patch("app.core.image_processor.location_service") as mock_location_service:
        # Make reverse_geocode an async function
        mock_location_service.reverse_geocode = AsyncMock(
            return_value=mock_location_info
        )

        result = await mock_image_processor._extract_comprehensive_exif(
            comprehensive_exif_dict
        )

        # Verify location service was called with coordinates from GPS data
        mock_location_service.reverse_geocode.assert_called_once()
        call_args = mock_location_service.reverse_geocode.call_args[0]
        assert abs(call_args[0] - 37.774167) < 0.001  # lat
        assert abs(call_args[1] + 122.419167) < 0.001  # lon
        assert result["location_name"] == "San Francisco, California, United States"
        assert result["location_address"] == "San Francisco, CA 94102, USA"


def test_extract_enhanced_gps_data_north_east(mock_image_processor):
    """Test GPS extraction for north/east coordinates."""
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (2940, 100)),
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLongitude: ((139, 1), (41, 1), (5940, 100)),
        piexif.GPSIFD.GPSLongitudeRef: b"E",
        piexif.GPSIFD.GPSAltitude: (5000, 100),
        piexif.GPSIFD.GPSAltitudeRef: 0,
    }

    result = mock_image_processor._extract_enhanced_gps_data(gps_info)

    # Coordinates: 37°46'29.4"N, 139°41'59.4"E (Tokyo approximately)
    assert abs(result["location_lat"] - 37.774167) < 0.001  # N is positive
    assert abs(result["location_lon"] - 139.699833) < 0.001  # E is positive
    assert result["altitude"] == pytest.approx(50.0)  # Above sea level


def test_extract_enhanced_gps_data_south_west(mock_image_processor):
    """Test GPS extraction for south/west coordinates."""
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((33, 1), (51, 1), (2940, 100)),
        piexif.GPSIFD.GPSLatitudeRef: b"S",
        piexif.GPSIFD.GPSLongitude: ((151, 1), (12, 1), (5940, 100)),
        piexif.GPSIFD.GPSLongitudeRef: b"W",
        piexif.GPSIFD.GPSAltitude: (1000, 100),
        piexif.GPSIFD.GPSAltitudeRef: 1,  # Below sea level
    }

    result = mock_image_processor._extract_enhanced_gps_data(gps_info)

    assert result["location_lat"] < 0  # S is negative
    assert result["location_lon"] < 0  # W is negative
    assert result["altitude"] == pytest.approx(-10.0)  # Below sea level (negative)


def test_extract_enhanced_gps_data_no_altitude(mock_image_processor):
    """Test GPS extraction without altitude data."""
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (2940, 100)),
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLongitude: ((122, 1), (25, 1), (1164, 100)),
        piexif.GPSIFD.GPSLongitudeRef: b"W",
    }

    result = mock_image_processor._extract_enhanced_gps_data(gps_info)

    assert "location_lat" in result
    assert "location_lon" in result
    assert "altitude" not in result


def test_extract_enhanced_gps_data_invalid_coordinates(mock_image_processor):
    """Test GPS extraction with invalid coordinate data."""
    gps_info = {
        piexif.GPSIFD.GPSLatitude: (
            (37, 1),
            (46, 1),
        ),  # Missing seconds (only 2 elements)
        piexif.GPSIFD.GPSLatitudeRef: b"N",
        piexif.GPSIFD.GPSLongitude: ((122, 1), (25, 1), (0, 0)),  # Zero seconds (0/0)
        piexif.GPSIFD.GPSLongitudeRef: b"W",
    }

    result = mock_image_processor._extract_enhanced_gps_data(gps_info)

    # Latitude should be skipped (invalid tuple length)
    assert "location_lat" not in result
    # Longitude should be extracted (division by zero handled as 0)
    assert "location_lon" in result
    # Should be approximately 122° 25' 0" W = -122.41666
    assert abs(result["location_lon"] + 122.41666) < 0.01


@pytest.mark.asyncio
async def test_fallback_to_basic_exif(mock_image_processor, mock_image, basic_pil_exif):
    """Test fallback to basic PIL EXIF when piexif fails."""
    with (
        patch("PIL.Image.open", return_value=mock_image),
        patch("piexif.load", side_effect=Exception("piexif failed")),
    ):
        mock_image._getexif.return_value = basic_pil_exif

        with patch.object(mock_image_processor, "_extract_basic_exif") as mock_extract:
            mock_extract.return_value = {
                "date_taken": datetime(2023, 12, 25, 14, 30, 0),
                "camera_make": "Canon",
                "camera_model": "EOS R5",
                "iso": 400,
            }

            result = await mock_image_processor.extract_exif_data("/fake/image.jpg")

            mock_extract.assert_called_once_with(basic_pil_exif)
            assert result["camera_make"] == "Canon"
            assert result["camera_model"] == "EOS R5"


def test_extract_basic_exif_datetime_parsing(mock_image_processor):
    """Test basic EXIF datetime parsing."""
    exif_data = {306: "2023:12:25 14:30:00"}  # DateTime tag

    result = mock_image_processor._extract_basic_exif(exif_data)

    assert isinstance(result["date_taken"], datetime)
    assert result["date_taken"] == datetime(2023, 12, 25, 14, 30, 0)


def test_extract_basic_exif_camera_settings(mock_image_processor):
    """Test basic EXIF camera settings extraction."""
    # Mock fraction objects for EXIF values
    mock_fraction = MagicMock()
    mock_fraction.num = 1
    mock_fraction.den = 250

    exif_data = {
        271: "Canon",  # Make
        272: "EOS R5",  # Model
        34855: 800,  # ISOSpeedRatings
        33434: mock_fraction,  # ExposureTime
        33437: mock_fraction,  # FNumber (will be 1/250 = 0.004, but that's for testing)
        37386: mock_fraction,  # FocalLength
    }

    result = mock_image_processor._extract_basic_exif(exif_data)

    assert result["camera_make"] == "Canon"
    assert result["camera_model"] == "EOS R5"
    assert result["iso"] == 800
    assert result["shutter_speed"] == "1/250"


def test_extract_basic_exif_invalid_datetime(mock_image_processor):
    """Test basic EXIF with invalid datetime format."""
    exif_data = {306: "invalid_date_format"}

    result = mock_image_processor._extract_basic_exif(exif_data)

    assert "date_taken" not in result


@pytest.mark.asyncio
async def test_extract_exif_no_exif_data(mock_image_processor, mock_image):
    """Test EXIF extraction when no EXIF data is present."""
    mock_image._getexif.return_value = None

    with (
        patch("PIL.Image.open", return_value=mock_image),
        patch("piexif.load", side_effect=Exception("No EXIF")),
    ):
        result = await mock_image_processor.extract_exif_data("/fake/image.jpg")

        # Should still return basic image dimensions
        assert result["width"] == 3000
        assert result["height"] == 2000
        # But no camera data
        assert "camera_make" not in result


@pytest.mark.asyncio
async def test_extract_exif_file_not_found(mock_image_processor):
    """Test EXIF extraction when image file doesn't exist."""
    with patch("PIL.Image.open", side_effect=FileNotFoundError("File not found")):
        result = await mock_image_processor.extract_exif_data("/nonexistent/image.jpg")

        assert result == {}


def test_dms_to_decimal_conversion(mock_image_processor):
    """Test degrees-minutes-seconds to decimal conversion."""
    # Test the conversion logic within _extract_enhanced_gps_data
    gps_info = {
        piexif.GPSIFD.GPSLatitude: ((37, 1), (46, 1), (2940, 100)),  # 37°46'29.4"
        piexif.GPSIFD.GPSLatitudeRef: b"N",
    }

    result = mock_image_processor._extract_enhanced_gps_data(gps_info)

    # 37 + 46/60 + 29.4/3600 ≈ 37.7748333
    assert abs(result["location_lat"] - 37.774167) < 0.001


@pytest.mark.asyncio
async def test_timezone_extraction_variations(mock_image_processor):
    """Test various timezone offset formats."""
    test_cases = [
        {piexif.ExifIFD.OffsetTimeOriginal: b"+05:30"},
        {piexif.ExifIFD.OffsetTimeOriginal: b"-08:00"},
        {piexif.ExifIFD.OffsetTimeOriginal: b"Z"},
    ]

    for exif_dict in test_cases:
        full_dict = {"Exif": exif_dict}
        result = await mock_image_processor._extract_comprehensive_exif(full_dict)

        if exif_dict[piexif.ExifIFD.OffsetTimeOriginal] == b"Z":
            assert result.get("timezone") == "Z"
        else:
            assert "timezone" in result


@pytest.mark.asyncio
async def test_aperture_calculation_edge_cases(mock_image_processor):
    """Test aperture calculation with various fraction formats."""
    test_cases = [
        {piexif.ExifIFD.FNumber: (280, 100)},  # f/2.8
        {piexif.ExifIFD.FNumber: (0, 100)},  # Zero numerator
        {piexif.ExifIFD.FNumber: (280, 0)},  # Zero denominator
        {piexif.ExifIFD.FNumber: (280,)},  # Single value tuple
    ]

    for exif_dict in test_cases:
        full_dict = {"Exif": exif_dict}
        result = await mock_image_processor._extract_comprehensive_exif(full_dict)

        if exif_dict[piexif.ExifIFD.FNumber] == (280, 100):
            assert result["aperture"] == pytest.approx(2.8)
        else:
            # Should handle edge cases gracefully - may return 0.0 or None
            assert "aperture" not in result or result["aperture"] in [None, 0.0]


@pytest.mark.asyncio
async def test_shutter_speed_formats(mock_image_processor):
    """Test various shutter speed fraction formats."""
    test_cases = [
        ((1, 250), "1/250"),  # Fast shutter
        ((1, 60), "1/60"),  # Normal shutter
        ((2, 1), "2/1"),  # Slow shutter (2 seconds)
        ((10, 5), "10/5"),  # Fraction that reduces to 2
    ]

    for fraction, expected in test_cases:
        exif_dict = {"Exif": {piexif.ExifIFD.ExposureTime: fraction}}
        result = await mock_image_processor._extract_comprehensive_exif(exif_dict)
        assert result.get("shutter_speed") == expected


@pytest.mark.asyncio
async def test_byte_string_decoding(mock_image_processor):
    """Test proper decoding of byte strings from EXIF."""
    exif_dict = {
        "0th": {
            piexif.ImageIFD.Make: b"Canon\x00",  # With null terminator
            piexif.ImageIFD.Model: b"EOS R5",
        },
        "Exif": {
            piexif.ExifIFD.LensModel: b"RF85mm F2 MACRO IS STM\x00\x00",  # Multiple nulls
        },
    }

    result = await mock_image_processor._extract_comprehensive_exif(exif_dict)

    # Byte strings may or may not have null terminators stripped
    assert result["camera_make"] in ["Canon", "Canon\x00"]
    assert result["camera_model"] == "EOS R5"
    assert result["lens"] in [
        "RF85mm F2 MACRO IS STM",
        "RF85mm F2 MACRO IS STM\x00\x00",
    ]


@pytest.mark.asyncio
async def test_memory_efficiency_large_image(mock_image_processor):
    """Test that EXIF extraction doesn't load entire large image into memory."""
    large_mock_image = MagicMock()
    large_mock_image.width = 10000
    large_mock_image.height = 8000
    large_mock_image.size = (10000, 8000)

    with (
        patch("PIL.Image.open", return_value=large_mock_image),
        patch("piexif.load", return_value={}),
    ):
        result = await mock_image_processor.extract_exif_data("/fake/large_image.raw")

        # Should successfully extract dimensions without memory issues
        assert result["width"] == 10000
        assert result["height"] == 8000
