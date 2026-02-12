"""
Profile Pictures API Integration Tests

Covers upload (square and non-square validation), listing (admin-only),
activation flow, and detail retrieval including URL fields.
"""

from __future__ import annotations

import tempfile

import pytest
from httpx import AsyncClient
from PIL import Image


def _create_temp_image(width: int, height: int) -> str:
    """Create a temporary JPEG image and return its file path."""
    img = Image.new("RGB", (width, height), color="red")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_file:
        img.save(temp_file, format="JPEG")
        return temp_file.name


@pytest.mark.integration
@pytest.mark.api
async def test_upload_square_image_succeeds(
    async_client: AsyncClient, admin_token: str
):
    """POST /api/profile-pictures accepts approximately square images."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    temp_file_path = _create_temp_image(400, 400)
    try:
        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("square.jpg", img_file, "image/jpeg")}
            data = {"title": "Square Avatar"}
            response = await async_client.post(
                "/api/profile-pictures", headers=headers, files=files, data=data
            )

        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["title"] == "Square Avatar"
        # width/height should be present (comes from EXIF extraction)
        assert "width" in data
        assert "height" in data
        # URLs should be populated
        assert data.get("original_url")
        assert data.get("download_url")
    finally:
        import os  # noqa: PLC0415

        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.api
async def test_upload_non_square_image_rejected(
    async_client: AsyncClient, admin_token: str
):
    """Non-square images should be rejected with a helpful message."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    temp_file_path = _create_temp_image(800, 300)
    try:
        with open(temp_file_path, "rb") as img_file:
            files = {"file": ("rect.jpg", img_file, "image/jpeg")}
            data = {"title": "Rect Avatar"}
            response = await async_client.post(
                "/api/profile-pictures", headers=headers, files=files, data=data
            )

        assert response.status_code == 400
        detail = response.json().get("detail", "")
        assert "square" in detail.lower()
    finally:
        import os  # noqa: PLC0415

        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)


@pytest.mark.integration
@pytest.mark.api
async def test_list_requires_admin(async_client: AsyncClient):
    """GET /api/profile-pictures is admin-only."""
    response = await async_client.get("/api/profile-pictures")
    assert response.status_code in [401, 403]


@pytest.mark.integration
@pytest.mark.api
async def test_activate_and_get_active(async_client: AsyncClient, admin_token: str):
    """Upload two, activate the second, and verify /active returns it."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Upload first (square)
    path1 = _create_temp_image(300, 300)
    # Upload second (square)
    path2 = _create_temp_image(400, 400)

    try:
        # First
        with open(path1, "rb") as f1:
            r1 = await async_client.post(
                "/api/profile-pictures",
                headers=headers,
                files={"file": ("p1.jpg", f1, "image/jpeg")},
                data={"title": "P1"},
            )
        assert r1.status_code == 200
        r1.json()["id"]

        # Second
        with open(path2, "rb") as f2:
            r2 = await async_client.post(
                "/api/profile-pictures",
                headers=headers,
                files={"file": ("p2.jpg", f2, "image/jpeg")},
                data={"title": "P2"},
            )
        assert r2.status_code == 200
        id2 = r2.json()["id"]

        # Activate the second
        ra = await async_client.put(
            f"/api/profile-pictures/{id2}/activate", headers=headers
        )
        assert ra.status_code == 200
        assert ra.json()["is_active"] is True

        # Get active
        ga = await async_client.get("/api/profile-pictures/active")
        assert ga.status_code == 200
        active = ga.json().get("profile_picture")
        assert active is not None
        assert active["id"] == id2
        assert active.get("original_url")
    finally:
        import os  # noqa: PLC0415

        for p in (path1, path2):
            if os.path.exists(p):
                os.unlink(p)
