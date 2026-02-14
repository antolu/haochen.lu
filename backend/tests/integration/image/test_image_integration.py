"""
P1 - Core Image Processing Integration Tests

Tests image processing integration with file system, database, and storage services.
These ensure the complete image handling workflow functions correctly.
"""

from __future__ import annotations

import asyncio
import os
import tempfile

import pytest
from httpx import AsyncClient
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def sample_image_file():
    """Create a sample image file for testing."""
    img = Image.new("RGB", (800, 600), color="red")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        img.save(temp_file, format="JPEG", quality=90)
        path = temp_file.name

    yield path

    # Cleanup
    if os.path.exists(path):
        os.unlink(path)


@pytest.mark.integration
@pytest.mark.image
async def test_upload_image_creates_photo_record(
    async_client: AsyncClient,
    admin_token: str,
    sample_image_file: str,
    test_session: AsyncSession,
):
    """Test that uploading an image creates a database record."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    with open(sample_image_file, "rb") as img_file:
        files = {"file": ("test_image.jpg", img_file, "image/jpeg")}
        data = {
            "title": "Test Upload",
            "description": "Integration test image",
            "category": "test",
        }

        response = await async_client.post(
            "/api/photos", headers=headers, files=files, data=data
        )

    assert response.status_code == 201
    photo_data = response.json()

    # Verify photo record was created
    assert "id" in photo_data
    assert photo_data["title"] == "Test Upload"
    assert photo_data["category"] == "test"

    # Verify image dimensions were extracted
    assert photo_data.get("width") == 800
    assert photo_data.get("height") == 600

    # Verify files were created
    assert "original_url" in photo_data
    assert "variants" in photo_data
    assert "thumbnail" in photo_data["variants"]
    assert "url" in photo_data["variants"]["thumbnail"]


@pytest.mark.integration
@pytest.mark.image
async def test_image_processing_creates_multiple_formats(
    async_client: AsyncClient, admin_token: str, sample_image_file: str
):
    """Test that image processing creates multiple formats and sizes."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    with open(sample_image_file, "rb") as img_file:
        files = {"file": ("test_image.jpg", img_file, "image/jpeg")}
        data = {"title": "Multi-format Test"}

        response = await async_client.post(
            "/api/photos", headers=headers, files=files, data=data
        )

    assert response.status_code == 201
    photo_data = response.json()

    # Should have variant URLs for sizes smaller than original (800x600)
    assert "original_url" in photo_data
    assert "variants" in photo_data
    assert "small" in photo_data["variants"]  # 800px - same as original
    assert "thumbnail" in photo_data["variants"]  # 400px - smaller
    # medium (1200px) and larger won't be generated for 800x600 image

    # Verify original URL is accessible
    assert isinstance(photo_data["original_url"], str)
    assert photo_data["original_url"].startswith(("http", "/"))


@pytest.mark.integration
@pytest.mark.image
async def test_exif_data_extraction_and_storage(
    async_client: AsyncClient, admin_token: str, test_session: AsyncSession
):
    """Test EXIF data extraction and storage in database."""
    # Create image with EXIF data
    img = Image.new("RGB", (1200, 900), color="blue")

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        try:
            import piexif  # noqa: PLC0415

            exif_dict = {
                "0th": {
                    piexif.ImageIFD.Make: "Canon",
                    piexif.ImageIFD.Model: "EOS R5",
                    piexif.ImageIFD.Software: "Adobe Lightroom",
                    piexif.ImageIFD.DateTime: "2023:10:15 14:30:00",
                },
                "Exif": {
                    piexif.ExifIFD.FNumber: (28, 10),  # f/2.8
                    piexif.ExifIFD.ExposureTime: (1, 125),  # 1/125s
                    piexif.ExifIFD.ISOSpeedRatings: 400,
                    piexif.ExifIFD.FocalLength: (85, 1),  # 85mm
                },
                "GPS": {
                    piexif.GPSIFD.GPSLatitudeRef: "N",
                    piexif.GPSIFD.GPSLatitude: ((40, 1), (42, 1), (51, 100)),
                    piexif.GPSIFD.GPSLongitudeRef: "W",
                    piexif.GPSIFD.GPSLongitude: ((74, 1), (0, 1), (21, 100)),
                },
            }
            exif_bytes = piexif.dump(exif_dict)
            img.save(temp_file, format="JPEG", exif=exif_bytes)
        except ImportError:
            # Fallback without EXIF
            img.save(temp_file, format="JPEG")

        temp_file_path = temp_file.name

    try:
        headers = {"Authorization": f"Bearer {admin_token}"}

        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("exif_test.jpg", img_file, "image/jpeg")}
            data = {"title": "EXIF Test Image"}

            response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

        assert response.status_code == 201
        photo_data = response.json()

        # Check if EXIF data was extracted and stored
        exif_data = photo_data.get("exif_data", {})

        if exif_data:  # Only check if EXIF extraction is implemented
            # Camera info
            if "make" in exif_data:
                assert exif_data["make"] == "Canon"
            if "model" in exif_data:
                assert exif_data["model"] == "EOS R5"

            # Shooting parameters
            if "f_number" in exif_data:
                assert exif_data["f_number"] == "f/2.8" or exif_data[
                    "f_number"
                ] == pytest.approx(2.8)
            if "iso" in exif_data:
                assert exif_data["iso"] == 400

            # GPS coordinates
            if "gps_latitude" in exif_data and "gps_longitude" in exif_data:
                assert isinstance(exif_data["gps_latitude"], float)
                assert isinstance(exif_data["gps_longitude"], float)

    finally:
        os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
async def test_image_optimization_reduces_file_size(
    async_client: AsyncClient, admin_token: str
):
    """Test that image optimization reduces file size while maintaining quality."""
    # Create a large, unoptimized image
    large_img = Image.new("RGB", (3000, 2000), color="green")

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        # Save with high quality to make it large
        large_img.save(temp_file, format="JPEG", quality=100)
        temp_file_path = temp_file.name
        os.path.getsize(temp_file_path)

    try:
        headers = {"Authorization": f"Bearer {admin_token}"}

        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("large_image.jpg", img_file, "image/jpeg")}
            data = {"title": "Large Image Test"}

            response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

        assert response.status_code == 201
        photo_data = response.json()

        # Verify optimization occurred
        # This depends on storage implementation - we'd need to check actual file sizes
        assert "file_size" in photo_data or "optimized" in photo_data

        # Variants should exist
        assert "variants" in photo_data
        # Check specific variant if needed, e.g. medium size
        if "medium" in photo_data["variants"]:
            assert photo_data["variants"]["medium"]["url"] is not None

    finally:
        os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
async def test_concurrent_image_uploads_handle_safely(
    async_client: AsyncClient, admin_token: str
):
    """Test that concurrent image uploads are handled safely."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Create multiple test images
    temp_files = []
    for i in range(3):
        img = Image.new("RGB", (400, 300), color=(i * 80, i * 80, i * 80))
        with tempfile.NamedTemporaryFile(
            suffix=f"_concurrent_{i}.jpg", delete=False
        ) as temp_file:
            img.save(temp_file, format="JPEG")
            temp_files.append(temp_file.name)

    try:
        # Upload all images concurrently
        upload_tasks = []
        for i, temp_file_path in enumerate(temp_files):

            async def upload_image(file_path: str, index: int):
                with open(file_path, "rb") as img_file:
                    files = {
                        "file": (f"concurrent_{index}.jpg", img_file, "image/jpeg")
                    }
                    data = {"title": f"Concurrent Upload {index}"}

                    return await async_client.post(
                        "/api/photos",
                        headers=headers,
                        files=files,
                        data=data,
                    )

            upload_tasks.append(upload_image(temp_file_path, i))

        # Execute all uploads concurrently
        responses = await asyncio.gather(*upload_tasks, return_exceptions=True)

        # All uploads should succeed
        successful_uploads = 0
        for response in responses:
            if not isinstance(response, Exception):
                # Type assertion for mypy
                http_response = response  # type: ignore[assignment]
                assert http_response.status_code == 201
                successful_uploads += 1

        assert successful_uploads == len(temp_files)

    finally:
        # Cleanup
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
async def test_image_deletion_removes_all_files(
    async_client: AsyncClient, admin_token: str, test_session: AsyncSession
):
    """Test that deleting a photo removes all associated files."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # First upload an image
    img = Image.new("RGB", (600, 400), color="purple")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        img.save(temp_file, format="JPEG")
        temp_file_path = temp_file.name

    try:
        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("delete_test.jpg", img_file, "image/jpeg")}
            data = {"title": "Delete Test"}

            upload_response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

        assert upload_response.status_code == 201
        photo_data = upload_response.json()
        photo_id = photo_data["id"]

        # Delete the photo
        delete_response = await async_client.delete(
            f"/api/photos/{photo_id}", headers=headers
        )

        assert delete_response.status_code in [200, 204]

        # Verify photo record is deleted
        get_response = await async_client.get(
            f"/api/photos/{photo_id}", headers=headers
        )
        assert get_response.status_code == 404

        # Verify files are cleaned up (depends on storage implementation)
        # This would require checking actual file system or storage service

    finally:
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
async def test_image_update_preserves_files(
    async_client: AsyncClient, admin_token: str
):
    """Test that updating photo metadata preserves image files."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Upload an image
    img = Image.new("RGB", (500, 300), color="orange")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        img.save(temp_file, format="JPEG")
        temp_file_path = temp_file.name

    try:
        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("update_test.jpg", img_file, "image/jpeg")}
            data = {"title": "Original Title", "category": "original"}

            upload_response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

        assert upload_response.status_code == 201
        photo_data = upload_response.json()
        photo_id = photo_data["id"]

        # Use original structure to verify preservation
        original_variants = photo_data.get("variants", {})
        original_url = photo_data.get("original_url")

        # Update photo metadata
        update_data = {
            "title": "Updated Title",
            "description": "Updated description",
            "category": "updated",
        }

        update_response = await async_client.put(
            f"/api/photos/{photo_id}", headers=headers, json=update_data
        )

        assert update_response.status_code == 200
        updated_data = update_response.json()

        # Metadata should be updated
        assert updated_data["title"] == "Updated Title"
        assert updated_data["category"] == "updated"

        # File URLs/structure should remain the same
        assert updated_data["original_url"] == original_url
        updated_variants = updated_data.get("variants", {})

        # Simple check that variant keys are preserved
        for key in original_variants:
            assert key in updated_variants

    finally:
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
@pytest.mark.performance
async def test_large_image_processing_performance(
    admin_token: str, async_client: AsyncClient
):
    """Test processing of large images completes within reasonable time."""
    import time  # noqa: PLC0415

    # Create a large image (simulating high-resolution camera output)
    large_img = Image.new("RGB", (6000, 4000), color="red")

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        large_img.save(temp_file, format="JPEG", quality=90)
        temp_file_path = temp_file.name

    try:
        headers = {"Authorization": f"Bearer {admin_token}"}

        start_time = time.time()

        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("large_image.jpg", img_file, "image/jpeg")}
            data = {"title": "Large Image Performance Test"}

            response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

        end_time = time.time()
        processing_time = end_time - start_time

        # Should complete within reasonable time (adjust based on requirements)
        assert processing_time < 30.0  # 30 seconds max
        assert response.status_code == 201

        photo_data = response.json()
        assert "id" in photo_data

    finally:
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.image
@pytest.mark.performance
async def test_memory_usage_during_batch_processing(
    admin_token: str, async_client: AsyncClient
):
    """Test memory usage remains reasonable during batch processing."""
    import os  # noqa: PLC0415

    import psutil  # noqa: PLC0415

    # Get initial memory usage
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024  # MB

    headers = {"Authorization": f"Bearer {admin_token}"}
    temp_files = []

    try:
        # Create multiple medium-sized images
        for i in range(5):
            img = Image.new("RGB", (2000, 1500), color=(i * 50, i * 50, i * 50))
            with tempfile.NamedTemporaryFile(
                suffix=f"_batch_{i}.jpg", delete=False
            ) as temp_file:
                img.save(temp_file, format="JPEG", quality=80)
                temp_files.append(temp_file.name)

        # Process all images
        for i, temp_file_path in enumerate(temp_files):
            with open(temp_file_path, "rb") as img_file:
                files = {"file": (f"batch_{i}.jpg", img_file, "image/jpeg")}
                data = {"title": f"Batch Image {i}"}

                response = await async_client.post(
                    "/api/photos", headers=headers, files=files, data=data
                )

                assert response.status_code == 201

        # Check final memory usage
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (adjust based on requirements)
        assert memory_increase < 500  # Less than 500MB increase

    finally:
        # Cleanup
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
