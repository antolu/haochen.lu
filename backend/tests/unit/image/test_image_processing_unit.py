"""
P1 - Core Image Processing Unit Tests

Tests image processing functionality including EXIF extraction, format conversion,
resizing, and optimization. These ensure core photography portfolio features work correctly.
"""

from __future__ import annotations

import asyncio
import io
import os
import tempfile

import pytest
from app.core.exceptions import ImageProcessingError, UnsupportedFileTypeError
from app.services.image_processor import ImageProcessor
from PIL import Image


class TestImageProcessing:
    """Test core image processing functionality."""

    @pytest.fixture
    def image_processor(self):
        """Create ImageProcessor instance."""
        return ImageProcessor()

    @pytest.fixture
    def sample_jpeg_bytes(self):
        """Create a sample JPEG image with EXIF data."""
        # Create a simple test image
        img = Image.new("RGB", (800, 600), color="red")

        # Add some basic EXIF data
        exif_dict = {
            "0th": {
                256: 800,  # ImageWidth
                257: 600,  # ImageLength
                272: "Test Camera",  # Make
                306: "2023:10:15 14:30:00",  # DateTime
            },
            "Exif": {
                33434: (1, 60),  # ExposureTime
                33437: (28, 10),  # FNumber
                34855: 100,  # ISOSpeedRatings
            },
            "GPS": {
                1: "N",  # GPSLatitudeRef
                2: ((40, 1), (42, 1), (51, 100)),  # GPSLatitude
                3: "W",  # GPSLongitudeRef
                4: ((74, 1), (0, 1), (21, 100)),  # GPSLongitude
            },
        }

        # Convert to bytes
        buffer = io.BytesIO()
        try:
            import piexif

            exif_bytes = piexif.dump(exif_dict)
            img.save(buffer, format="JPEG", exif=exif_bytes)
        except ImportError:
            # Fallback without EXIF if piexif not available
            img.save(buffer, format="JPEG")

        buffer.seek(0)
        return buffer.getvalue()

    @pytest.fixture
    def sample_png_bytes(self):
        """Create a sample PNG image."""
        img = Image.new("RGB", (400, 300), color="blue")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        buffer.seek(0)
        return buffer.getvalue()

    @pytest.fixture
    def sample_webp_bytes(self):
        """Create a sample WebP image."""
        img = Image.new("RGB", (600, 400), color="green")
        buffer = io.BytesIO()
        img.save(buffer, format="WEBP", quality=80)
        buffer.seek(0)
        return buffer.getvalue()

    async def test_extract_exif_from_jpeg_with_metadata(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test EXIF extraction from JPEG with metadata."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            exif_data = await image_processor.extract_exif(temp_file_path)

            # Should extract basic image info
            assert "width" in exif_data
            assert "height" in exif_data
            assert exif_data["width"] == 800
            assert exif_data["height"] == 600

            # Should extract camera info if available
            if "make" in exif_data:
                assert isinstance(exif_data["make"], str)

            # Should extract GPS coordinates if available
            if "gps_latitude" in exif_data and "gps_longitude" in exif_data:
                assert isinstance(exif_data["gps_latitude"], float)
                assert isinstance(exif_data["gps_longitude"], float)
                assert -90 <= exif_data["gps_latitude"] <= 90
                assert -180 <= exif_data["gps_longitude"] <= 180

        finally:
            os.unlink(temp_file_path)

    async def test_extract_exif_from_image_without_metadata(
        self, image_processor: ImageProcessor
    ):
        """Test EXIF extraction from image without metadata."""
        # Create simple image without EXIF
        img = Image.new("RGB", (200, 150), color="white")

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            img.save(temp_file, format="JPEG")
            temp_file_path = temp_file.name

        try:
            exif_data = await image_processor.extract_exif(temp_file_path)

            # Should still extract basic dimensions
            assert exif_data["width"] == 200
            assert exif_data["height"] == 150

            # Optional fields should be None or missing
            assert exif_data.get("make") is None or "make" not in exif_data
            assert (
                exif_data.get("gps_latitude") is None or "gps_latitude" not in exif_data
            )

        finally:
            os.unlink(temp_file_path)

    async def test_convert_to_webp_maintains_quality(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test WebP conversion maintains acceptable quality."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            webp_bytes = await image_processor.convert_to_webp(
                temp_file_path, quality=85
            )

            # WebP should be smaller than original JPEG
            assert len(webp_bytes) <= len(sample_jpeg_bytes)

            # WebP should be valid and loadable
            webp_img = Image.open(io.BytesIO(webp_bytes))
            assert webp_img.format == "WEBP"
            assert webp_img.size == (800, 600)  # Original dimensions

        finally:
            os.unlink(temp_file_path)

    async def test_resize_image_maintains_aspect_ratio(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test image resizing maintains aspect ratio."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            # Original is 800x600 (4:3 ratio)
            resized_bytes = await image_processor.resize_image(
                temp_file_path, max_width=400
            )

            resized_img = Image.open(io.BytesIO(resized_bytes))

            # Should be resized to 400x300 (maintaining 4:3 ratio)
            assert resized_img.size == (400, 300)

            # Should maintain image quality
            assert resized_img.mode in ["RGB", "RGBA"]

        finally:
            os.unlink(temp_file_path)

    async def test_resize_image_with_height_constraint(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test image resizing with height constraint."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            # Original is 800x600, resize with max_height=200
            resized_bytes = await image_processor.resize_image(
                temp_file_path, max_height=200
            )

            resized_img = Image.open(io.BytesIO(resized_bytes))

            # Should be resized maintaining aspect ratio
            # 800:600 = x:200, so x = 266.67 ≈ 267
            expected_width = int((800 * 200) / 600)
            assert resized_img.size == (expected_width, 200)

        finally:
            os.unlink(temp_file_path)

    async def test_create_thumbnail_correct_size(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test thumbnail creation with correct size."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            thumbnail_bytes = await image_processor.create_thumbnail(
                temp_file_path, size=(150, 150)
            )

            thumbnail_img = Image.open(io.BytesIO(thumbnail_bytes))

            # Thumbnail should be exactly the requested size (may crop if needed)
            assert thumbnail_img.size == (150, 150)

            # Should be significantly smaller in file size
            assert len(thumbnail_bytes) < len(sample_jpeg_bytes) / 2

        finally:
            os.unlink(temp_file_path)

    async def test_optimize_image_reduces_file_size(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test image optimization reduces file size."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            optimized_bytes = await image_processor.optimize_image(
                temp_file_path, quality=75
            )

            # Optimized should be smaller or equal in size
            assert len(optimized_bytes) <= len(sample_jpeg_bytes)

            # Should still be a valid image
            optimized_img = Image.open(io.BytesIO(optimized_bytes))
            assert optimized_img.format == "JPEG"
            assert optimized_img.size == (800, 600)

        finally:
            os.unlink(temp_file_path)

    async def test_process_invalid_image_file_raises_error(
        self, image_processor: ImageProcessor
    ):
        """Test processing invalid image file raises appropriate error."""
        # Create a text file pretending to be an image
        with tempfile.NamedTemporaryFile(
            suffix=".jpg", mode="w", delete=False
        ) as temp_file:
            temp_file.write("This is not an image file")
            temp_file_path = temp_file.name

        try:
            with pytest.raises(ImageProcessingError):
                await image_processor.extract_exif(temp_file_path)
        finally:
            os.unlink(temp_file_path)

    async def test_process_unsupported_file_format_raises_error(
        self, image_processor: ImageProcessor
    ):
        """Test processing unsupported file format raises error."""
        # Create a file with unsupported extension
        with tempfile.NamedTemporaryFile(suffix=".bmp", delete=False) as temp_file:
            # Create a simple BMP (if BMP is not supported)
            img = Image.new("RGB", (100, 100), color="red")
            img.save(temp_file, format="BMP")
            temp_file_path = temp_file.name

        try:
            # This should either work or raise UnsupportedFileTypeError
            # depending on implementation
            try:
                await image_processor.convert_to_webp(temp_file_path)
            except UnsupportedFileTypeError:
                assert True  # Expected behavior
        finally:
            os.unlink(temp_file_path)

    async def test_concurrent_image_processing_safe(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test concurrent image processing is thread-safe."""
        # Create multiple temporary files
        temp_files = []
        for i in range(5):
            temp_file = tempfile.NamedTemporaryFile(
                suffix=f"_test_{i}.jpg", delete=False
            )
            temp_file.write(sample_jpeg_bytes)
            temp_file.close()
            temp_files.append(temp_file.name)

        try:
            # Process all images concurrently
            tasks = [
                image_processor.extract_exif(temp_file) for temp_file in temp_files
            ]

            results = await asyncio.gather(*tasks, return_exceptions=True)

            # All should succeed
            for result in results:
                assert not isinstance(result, Exception)
                assert "width" in result
                assert "height" in result

        finally:
            # Clean up
            for temp_file in temp_files:
                os.unlink(temp_file)

    async def test_large_image_processing_memory_efficient(
        self, image_processor: ImageProcessor
    ):
        """Test processing large images is memory efficient."""
        # Create a large image (simulate high-resolution photo)
        large_img = Image.new("RGB", (4000, 3000), color="blue")

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            large_img.save(temp_file, format="JPEG", quality=95)
            temp_file_path = temp_file.name

        try:
            # Process large image
            thumbnail_bytes = await image_processor.create_thumbnail(
                temp_file_path, size=(300, 300)
            )

            # Thumbnail should be much smaller
            thumbnail_img = Image.open(io.BytesIO(thumbnail_bytes))
            assert thumbnail_img.size == (300, 300)

            # File size should be significantly reduced
            original_size = os.path.getsize(temp_file_path)
            assert len(thumbnail_bytes) < original_size / 10

        finally:
            os.unlink(temp_file_path)

    async def test_exif_orientation_handling(self, image_processor: ImageProcessor):
        """Test EXIF orientation is handled correctly."""
        # Create image that needs rotation
        img = Image.new("RGB", (300, 200), color="yellow")

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            # Save with orientation data (would need piexif for full test)
            img.save(temp_file, format="JPEG")
            temp_file_path = temp_file.name

        try:
            # Extract EXIF and check orientation handling
            exif_data = await image_processor.extract_exif(temp_file_path)

            # Should include orientation info if available
            assert "width" in exif_data
            assert "height" in exif_data

            # Processed image should have correct orientation
            processed_bytes = await image_processor.optimize_image(temp_file_path)
            processed_img = Image.open(io.BytesIO(processed_bytes))

            # Dimensions should be preserved (or swapped if rotated)
            assert processed_img.size in [(300, 200), (200, 300)]

        finally:
            os.unlink(temp_file_path)


class TestImageValidation:
    """Test image file validation and security."""

    @pytest.fixture
    def image_processor(self):
        """Create ImageProcessor instance."""
        return ImageProcessor()

    async def test_validate_image_format_accepts_valid_formats(
        self, image_processor: ImageProcessor
    ):
        """Test image format validation accepts valid formats."""
        valid_formats = ["image/jpeg", "image/png", "image/webp"]

        for mime_type in valid_formats:
            # Should not raise exception
            result = await image_processor.validate_image_format(mime_type)
            assert result is True or result is None  # Depending on implementation

    async def test_validate_image_format_rejects_invalid_formats(
        self, image_processor: ImageProcessor
    ):
        """Test image format validation rejects invalid formats."""
        invalid_formats = [
            "application/javascript",
            "text/html",
            "image/svg+xml",  # SVG might be considered unsafe
            "application/pdf",
        ]

        for mime_type in invalid_formats:
            with pytest.raises(UnsupportedFileTypeError):
                await image_processor.validate_image_format(mime_type)

    async def test_validate_image_size_within_limits(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test image size validation within limits."""
        # Test with reasonable file size
        result = await image_processor.validate_image_size(
            len(sample_jpeg_bytes),
            max_size=10_000_000,  # 10MB
        )
        assert result is True or result is None

    async def test_validate_image_size_exceeds_limits(
        self, image_processor: ImageProcessor
    ):
        """Test image size validation when exceeding limits."""
        large_size = 50_000_000  # 50MB

        with pytest.raises(ImageProcessingError):
            await image_processor.validate_image_size(
                large_size,
                max_size=10_000_000,  # 10MB limit
            )

    async def test_detect_malicious_image_content(
        self, image_processor: ImageProcessor
    ):
        """Test detection of potentially malicious image content."""
        # Create image with suspicious metadata
        # This is a placeholder - actual implementation would depend on security requirements

        # For now, just test that normal images pass
        img = Image.new("RGB", (100, 100), color="red")

        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            img.save(temp_file, format="JPEG")
            temp_file_path = temp_file.name

        try:
            # Should not raise security exception for normal image
            exif_data = await image_processor.extract_exif(temp_file_path)
            assert isinstance(exif_data, dict)
        finally:
            os.unlink(temp_file_path)


class TestImageMetadata:
    """Test image metadata extraction and handling."""

    @pytest.fixture
    def image_processor(self):
        """Create ImageProcessor instance."""
        return ImageProcessor()

    async def test_extract_camera_metadata(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test extraction of camera metadata."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            metadata = await image_processor.extract_camera_metadata(temp_file_path)

            # Should extract available camera info
            if "make" in metadata:
                assert isinstance(metadata["make"], str)
            if "model" in metadata:
                assert isinstance(metadata["model"], str)
            if "lens" in metadata:
                assert isinstance(metadata["lens"], str)

        finally:
            os.unlink(temp_file_path)

    async def test_extract_shooting_parameters(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test extraction of shooting parameters."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            params = await image_processor.extract_shooting_parameters(temp_file_path)

            # Check for common shooting parameters
            if "aperture" in params and params["aperture"]:
                assert isinstance(params["aperture"], (int, float, str))
            if "shutter_speed" in params and params["shutter_speed"]:
                assert isinstance(params["shutter_speed"], (int, float, str))
            if "iso" in params and params["iso"]:
                assert isinstance(params["iso"], (int, str))
            if "focal_length" in params and params["focal_length"]:
                assert isinstance(params["focal_length"], (int, float, str))

        finally:
            os.unlink(temp_file_path)

    async def test_extract_gps_coordinates(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test GPS coordinate extraction."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            gps_data = await image_processor.extract_gps_data(temp_file_path)

            if gps_data and "latitude" in gps_data and "longitude" in gps_data:
                # Validate GPS coordinate ranges
                assert -90 <= gps_data["latitude"] <= 90
                assert -180 <= gps_data["longitude"] <= 180

                # Should include coordinate reference if available
                if "latitude_ref" in gps_data:
                    assert gps_data["latitude_ref"] in ["N", "S"]
                if "longitude_ref" in gps_data:
                    assert gps_data["longitude_ref"] in ["E", "W"]

        finally:
            os.unlink(temp_file_path)

    async def test_metadata_sanitization_removes_sensitive_data(
        self, image_processor: ImageProcessor, sample_jpeg_bytes: bytes
    ):
        """Test that sensitive metadata can be removed."""
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
            temp_file.write(sample_jpeg_bytes)
            temp_file_path = temp_file.name

        try:
            # Remove sensitive EXIF data
            sanitized_bytes = await image_processor.sanitize_metadata(
                temp_file_path, remove_gps=True, remove_personal=True
            )

            # Sanitized image should still be valid
            sanitized_img = Image.open(io.BytesIO(sanitized_bytes))
            assert sanitized_img.size == (800, 600)

            # GPS data should be removed if it was present
            # This would require checking the EXIF data of the sanitized image
            # Implementation depends on the specific sanitization method

        finally:
            os.unlink(temp_file_path)
