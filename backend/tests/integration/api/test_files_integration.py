from __future__ import annotations

import io

import pytest


@pytest.fixture
def pdf_bytes() -> bytes:
    return b"%PDF-1.4 fake pdf content for testing"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_file_requires_auth(async_client):
    data = {"file": ("test.pdf", io.BytesIO(b"data"), "application/pdf")}
    response = await async_client.post("/api/files", files=data)
    assert response.status_code == 401


@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_and_serve_file(async_client, admin_headers, pdf_bytes):
    files = {"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    response = await async_client.post("/api/files", files=files, headers=admin_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["original_name"] == "test.pdf"
    assert body["url"] == "/files/test.pdf"
    assert body["file_size"] == len(pdf_bytes)

    serve_response = await async_client.get("/files/test.pdf")
    assert serve_response.status_code == 200
    assert serve_response.content == pdf_bytes


@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_collision_returns_409(async_client, admin_headers, pdf_bytes):
    files = {"file": ("collision.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    await async_client.post("/api/files", files=files, headers=admin_headers)

    files2 = {"file": ("collision.pdf", io.BytesIO(b"new content"), "application/pdf")}
    response = await async_client.post(
        "/api/files", files=files2, headers=admin_headers
    )
    assert response.status_code == 409
    assert response.json()["detail"]["conflict"] is True


@pytest.mark.integration
@pytest.mark.asyncio
async def test_upload_with_replace_overwrites(async_client, admin_headers, pdf_bytes):
    files = {"file": ("replace-me.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    await async_client.post("/api/files", files=files, headers=admin_headers)

    new_content = b"new content"
    files2 = {"file": ("replace-me.pdf", io.BytesIO(new_content), "application/pdf")}
    response = await async_client.post(
        "/api/files?replace=true", files=files2, headers=admin_headers
    )
    assert response.status_code == 201

    serve_response = await async_client.get("/files/replace-me.pdf")
    assert serve_response.content == new_content


@pytest.mark.integration
@pytest.mark.asyncio
async def test_rename_file(async_client, admin_headers, pdf_bytes):
    files = {"file": ("rename-before.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    upload = await async_client.post("/api/files", files=files, headers=admin_headers)
    file_id = upload.json()["id"]

    response = await async_client.patch(
        f"/api/files/{file_id}",
        json={"original_name": "rename-after.pdf"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["url"] == "/files/rename-after.pdf"

    serve = await async_client.get("/files/rename-after.pdf")
    assert serve.status_code == 200


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_file(async_client, admin_headers, pdf_bytes):
    files = {"file": ("to-delete.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    upload = await async_client.post("/api/files", files=files, headers=admin_headers)
    file_id = upload.json()["id"]

    response = await async_client.delete(f"/api/files/{file_id}", headers=admin_headers)
    assert response.status_code == 204

    serve = await async_client.get("/files/to-delete.pdf")
    assert serve.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_serve_nonexistent_file_returns_404(async_client):
    response = await async_client.get("/files/does-not-exist.pdf")
    assert response.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_files_returns_items_and_total(
    async_client, admin_headers, pdf_bytes
):
    files = {"file": ("list-test.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
    await async_client.post("/api/files", files=files, headers=admin_headers)

    response = await async_client.get("/api/files", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert "items" in body
    assert "total" in body
    assert isinstance(body["total"], int)
    assert body["total"] >= 1
    assert any(f["original_name"] == "list-test.pdf" for f in body["items"])
