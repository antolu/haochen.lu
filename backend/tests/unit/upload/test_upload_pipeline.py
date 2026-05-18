from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, UploadFile

from app.core.upload_pipeline import run_upload_pipeline


class FakeProcessor:
    call_count = 0

    async def process(self, file: object, filename: str) -> dict:
        FakeProcessor.call_count += 1
        return {
            "stored_filename": f"uuid.{filename.rsplit('.', maxsplit=1)[-1]}",
            "file_size": 100,
        }


class FailingProcessor:
    async def process(self, file: object, filename: str) -> dict:
        msg = "disk full"
        raise RuntimeError(msg)


def _make_upload(filename: str = "test.pdf", size: int = 100) -> UploadFile:
    f = MagicMock(spec=UploadFile)
    f.filename = filename
    f.size = size
    f.file = MagicMock()
    f.file.seek = MagicMock()
    return f


@pytest.mark.asyncio
async def test_pipeline_calls_processor():
    FakeProcessor.call_count = 0
    upload = _make_upload()
    validator = MagicMock()
    validator.validate_file = AsyncMock()
    validator.max_size = 50 * 1024 * 1024
    result = await run_upload_pipeline(
        upload, validator, FakeProcessor(), max_retries=1
    )
    assert result["stored_filename"].endswith(".pdf")
    assert FakeProcessor.call_count == 1


@pytest.mark.asyncio
async def test_pipeline_retries_on_failure():
    upload = _make_upload()
    validator = MagicMock()
    validator.validate_file = AsyncMock()
    validator.max_size = 50 * 1024 * 1024
    with pytest.raises(HTTPException) as exc_info:
        await run_upload_pipeline(upload, validator, FailingProcessor(), max_retries=2)
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_pipeline_rejects_oversized_file():
    upload = _make_upload(size=100 * 1024 * 1024)
    validator = MagicMock()
    validator.validate_file = AsyncMock()
    validator.max_size = 50 * 1024 * 1024
    with pytest.raises(HTTPException) as exc_info:
        await run_upload_pipeline(upload, validator, FakeProcessor(), max_retries=1)
    assert exc_info.value.status_code == 400
