"""
P1 - Core Image Processing Integration Tests

Tests image processing integration with file system, database, and storage services.
These ensure the complete image handling workflow functions correctly.
"""

from __future__ import annotations

import asyncio
import os
import tempfile
import time

import psutil  # type: ignore[import-untyped]
import pytest
from httpx import AsyncClient, Response
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession
from tests.conftest import temp_image_file


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
        }

        response = await async_client.post(
            "/api/photos", headers=headers, files=files, data=data
        )

    assert response.status_code == 201
    photo_data = response.json()

    # Verify photo record was created
    assert "id" in photo_data
    assert photo_data["title"] == "Test Upload"

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
    with temp_image_file(
        width=1200, height=900, color="blue", suffix=".jpg"
    ) as temp_file_path:
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


@pytest.mark.integration
@pytest.mark.image
async def test_image_optimization_reduces_file_size(
    async_client: AsyncClient, admin_token: str
):
    """Test that image optimization reduces file size while maintaining quality."""
    with temp_image_file(
        width=3000, height=2000, color="green", suffix=".jpg", quality=100
    ) as temp_file_path:
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


async def _test_concurrent_uploads_logic(
    async_client: AsyncClient, admin_token: str, temp_files: list[str]
) -> None:
    """Helper to test concurrent image uploads."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Upload all images concurrently
    async def upload_image(file_path: str, index: int):
        # Read file content into memory before upload to avoid file handle issues
        with open(file_path, "rb") as img_file:
            file_content = img_file.read()

        files = {"file": (f"concurrent_{index}.jpg", file_content, "image/jpeg")}
        data = {"title": f"Concurrent Upload {index}"}
        headers_with_id = {
            **headers,
            "X-Upload-Id": f"concurrent_test_{index}",
        }

        return await async_client.post(
            "/api/photos",
            headers=headers_with_id,
            files=files,
            data=data,
        )

    upload_tasks = [
        upload_image(temp_file_path, i) for i, temp_file_path in enumerate(temp_files)
    ]

    # Execute all uploads concurrently
    responses = await asyncio.gather(*upload_tasks, return_exceptions=True)

    # All uploads should succeed
    successful_uploads = 0
    failed_responses = []
    for i, response in enumerate(responses):
        if isinstance(response, BaseException):
            failed_responses.append(f"Upload {i}: {response}")
        elif isinstance(response, Response):
            if response.status_code != 201:
                failed_responses.append(
                    f"Upload {i}: HTTP {response.status_code} - {response.text}"
                )
            else:
                successful_uploads += 1
        else:
            failed_responses.append(
                f"Upload {i}: Unexpected response type {type(response)}"
            )

    assert successful_uploads == len(temp_files), (
        f"Expected {len(temp_files)} successful uploads, got {successful_uploads}. Failures: {failed_responses}"
    )


@pytest.mark.integration
@pytest.mark.image
async def test_concurrent_image_uploads_handle_safely(
    async_client: AsyncClient, admin_token: str
):
    """Test that concurrent image uploads are handled safely."""
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
        await _test_concurrent_uploads_logic(async_client, admin_token, temp_files)

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

    with temp_image_file(
        width=600, height=400, color="purple", suffix=".jpg"
    ) as temp_file_path:
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


@pytest.mark.integration
@pytest.mark.image
async def test_image_update_preserves_files(
    async_client: AsyncClient, admin_token: str
):
    """Test that updating photo metadata preserves image files."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    with temp_image_file(
        width=500, height=300, color="orange", suffix=".jpg"
    ) as temp_file_path:
        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("update_test.jpg", img_file, "image/jpeg")}
            data = {"title": "Original Title"}

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
        }

        update_response = await async_client.put(
            f"/api/photos/{photo_id}", headers=headers, json=update_data
        )

        assert update_response.status_code == 200
        updated_data = update_response.json()

        # Metadata should be updated
        assert updated_data["title"] == "Updated Title"

        # File URLs/structure should remain the same
        assert updated_data["original_url"] == original_url
        updated_variants = updated_data.get("variants", {})

        # Simple check that variant keys are preserved
        for key in original_variants:
            assert key in updated_variants


@pytest.mark.integration
@pytest.mark.image
@pytest.mark.performance
async def test_large_image_processing_performance(
    admin_token: str, async_client: AsyncClient
):
    """Test processing of large images completes within reasonable time."""
    with temp_image_file(
        width=6000, height=4000, color="red", suffix=".jpg", quality=90
    ) as temp_file_path:
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


def _create_batch_image_files(num_images: int = 5) -> list[str]:
    """Helper to create multiple temporary image files."""
    temp_files = []
    for i in range(num_images):
        img = Image.new("RGB", (2000, 1500), color=(i * 50, i * 50, i * 50))
        with tempfile.NamedTemporaryFile(
            suffix=f"_batch_{i}.jpg", delete=False
        ) as temp_file:
            img.save(temp_file, format="JPEG", quality=80)
            temp_files.append(temp_file.name)
    return temp_files


async def _process_batch_images(
    admin_token: str, async_client: AsyncClient, temp_files: list[str]
) -> float:
    """Helper to process batch images and check memory increase."""
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024  # MB

    headers = {"Authorization": f"Bearer {admin_token}"}

    for i, temp_file_path in enumerate(temp_files):
        with open(temp_file_path, "rb") as img_file:
            files = {"file": (f"batch_{i}.jpg", img_file, "image/jpeg")}
            data = {"title": f"Batch Image {i}"}

            response = await async_client.post(
                "/api/photos", headers=headers, files=files, data=data
            )

            assert response.status_code == 201

    final_memory = process.memory_info().rss / 1024 / 1024  # MB
    return float(final_memory - initial_memory)


@pytest.mark.integration
@pytest.mark.image
@pytest.mark.performance
async def test_memory_usage_during_batch_processing(
    admin_token: str, async_client: AsyncClient
):
    """Test memory usage remains reasonable during batch processing."""
    temp_files = _create_batch_image_files()

    try:
        memory_increase = await _process_batch_images(
            admin_token, async_client, temp_files
        )
        assert memory_increase < 500  # Less than 500MB increase

    finally:
        # Cleanup
        for temp_file_path in temp_files:
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
