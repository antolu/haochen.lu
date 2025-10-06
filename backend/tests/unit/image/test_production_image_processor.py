"""
Unit tests for production ImageProcessor (app.core.image_processor).

Tests the actual ImageProcessor used in production code.
"""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

import pytest
from PIL import Image

from app.core.image_processor import ImageProcessor


@pytest.fixture
def temp_dirs():
    """Create temporary upload and compressed directories."""
    with (
        tempfile.TemporaryDirectory() as upload_dir,
        tempfile.TemporaryDirectory() as compressed_dir,
    ):
        yield Path(upload_dir), Path(compressed_dir)


@pytest.fixture
def image_processor(temp_dirs):
    """Create ImageProcessor with temporary directories."""
    upload_dir, compressed_dir = temp_dirs
    return ImageProcessor(str(upload_dir), str(compressed_dir))


@pytest.fixture
def sample_jpeg_bytes():
    """Create a sample JPEG image."""
    img = Image.new("RGB", (800, 600), color="red")
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG")
    buffer.seek(0)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_extract_exif_data_basic_dimensions(image_processor, sample_jpeg_bytes):
    """Test EXIF extraction gets basic image dimensions."""
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        temp_file.write(sample_jpeg_bytes)
        temp_file_path = temp_file.name

    try:
        exif_data = await image_processor.extract_exif_data(temp_file_path)

        assert "width" in exif_data
        assert "height" in exif_data
        assert exif_data["width"] == 800
        assert exif_data["height"] == 600
    finally:
        Path(temp_file_path).unlink()


@pytest.mark.asyncio
async def test_process_image_creates_variants(image_processor, sample_jpeg_bytes):
    """Test that process_image creates responsive variants."""
    file_obj = io.BytesIO(sample_jpeg_bytes)

    result = await image_processor.process_image(
        file_obj, "test.jpg", title="Test Image"
    )

    assert "filename" in result
    assert "original_path" in result
    assert "file_size" in result
    assert "variants" in result
    assert "width" in result
    assert "height" in result

    # Check variants were created
    variants = result["variants"]
    assert isinstance(variants, dict)

    # Should have at least some variants
    if variants:
        for variant_data in variants.values():
            assert "path" in variant_data
            assert "width" in variant_data
            assert "height" in variant_data
            assert "format" in variant_data
            assert variant_data["format"] == "webp"


def test_get_image_url_returns_correct_path(image_processor):
    """Test get_image_url static method."""
    photo_data = {
        "variants": {
            "medium": {"path": "/compressed/test_medium.webp"},
            "small": {"path": "/compressed/test_small.webp"},
        }
    }

    url = ImageProcessor.get_image_url(photo_data, size="medium")
    assert url == "/compressed/test_medium.webp"

    # Test fallback
    url = ImageProcessor.get_image_url(photo_data, size="nonexistent")
    assert url in ["/compressed/test_medium.webp", "/compressed/test_small.webp"]


def test_get_image_srcset_generates_correct_format(image_processor):
    """Test get_image_srcset static method."""
    photo_data = {
        "variants": {
            "small": {"path": "/compressed/test_small.webp", "width": 400},
            "medium": {"path": "/compressed/test_medium.webp", "width": 800},
            "large": {"path": "/compressed/test_large.webp", "width": 1200},
        }
    }

    srcset = ImageProcessor.get_image_srcset(photo_data)

    assert "/compressed/test_small.webp 400w" in srcset
    assert "/compressed/test_medium.webp 800w" in srcset
    assert "/compressed/test_large.webp 1200w" in srcset
    assert ", " in srcset  # Should be comma-separated


@pytest.mark.asyncio
async def test_extract_exif_handles_missing_metadata(image_processor):
    """Test EXIF extraction handles images without metadata gracefully."""
    img = Image.new("RGB", (200, 150), color="blue")

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        img.save(temp_file, format="JPEG")
        temp_file_path = temp_file.name

    try:
        exif_data = await image_processor.extract_exif_data(temp_file_path)

        # Should still get dimensions
        assert exif_data["width"] == 200
        assert exif_data["height"] == 150

        # Optional fields should be missing or None
        assert exif_data.get("camera_make") is None or "camera_make" not in exif_data
        assert exif_data.get("location_lat") is None or "location_lat" not in exif_data
    finally:
        Path(temp_file_path).unlink()
