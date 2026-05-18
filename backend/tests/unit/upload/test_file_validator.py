from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException, UploadFile

from app.core.file_validation import FileValidator, file_validator


def _make_upload(
    content: bytes, content_type: str = "application/octet-stream"
) -> UploadFile:
    file = MagicMock(spec=UploadFile)
    file.read = AsyncMock(return_value=content)
    file.seek = AsyncMock()
    file.content_type = content_type
    return file


@pytest.mark.asyncio
async def test_validator_allows_all_when_no_extension_filter():
    validator = FileValidator(allowed_extensions=None, max_size=50 * 1024 * 1024)
    upload = _make_upload(b"PK\x03\x04" + b"\x00" * 100)
    with patch("filetype.guess") as mock_guess:
        mock_result = MagicMock()
        mock_result.extension = "zip"
        mock_result.mime = "application/zip"
        mock_guess.return_value = mock_result
        await validator.validate_file(upload)


@pytest.mark.asyncio
async def test_validator_rejects_disallowed_extension():
    validator = FileValidator(
        allowed_extensions={"jpg", "png"}, max_size=50 * 1024 * 1024
    )
    upload = _make_upload(b"PK\x03\x04" + b"\x00" * 100)
    with patch("filetype.guess") as mock_guess:
        mock_result = MagicMock()
        mock_result.extension = "zip"
        mock_result.mime = "application/zip"
        mock_guess.return_value = mock_result
        with pytest.raises(HTTPException) as exc_info:
            await validator.validate_file(upload)
        assert exc_info.value.status_code == 415


@pytest.mark.asyncio
async def test_validator_rejects_empty_file():
    validator = FileValidator(allowed_extensions=None, max_size=50 * 1024 * 1024)
    upload = _make_upload(b"")
    with pytest.raises(HTTPException) as exc_info:
        await validator.validate_file(upload)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_image_validator_rejects_zip():
    upload = _make_upload(b"PK\x03\x04" + b"\x00" * 100)
    with patch("filetype.guess") as mock_guess:
        mock_result = MagicMock()
        mock_result.extension = "zip"
        mock_result.mime = "application/zip"
        mock_guess.return_value = mock_result
        with pytest.raises(HTTPException) as exc_info:
            await file_validator.validate_image_file(upload)
        assert exc_info.value.status_code == 415
