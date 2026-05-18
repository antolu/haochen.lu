from __future__ import annotations

import io
import os
import tempfile

import pytest

from app.core.file_passthrough_processor import FilePassthroughProcessor


@pytest.mark.asyncio
async def test_passthrough_saves_file_to_disk():
    with tempfile.TemporaryDirectory() as tmpdir:
        processor = FilePassthroughProcessor(upload_dir=tmpdir)
        content = b"hello world pdf content"
        result = await processor.process(io.BytesIO(content), "test.pdf")

        assert result["original_name"] == "test.pdf"
        assert result["file_size"] == len(content)
        assert result["mime_type"] == "application/pdf"
        assert os.path.exists(result["original_path"])

        with open(result["original_path"], "rb") as f:
            stored = f.read()
        assert stored == content


@pytest.mark.asyncio
async def test_passthrough_generates_uuid_stored_filename():
    with tempfile.TemporaryDirectory() as tmpdir:
        processor = FilePassthroughProcessor(upload_dir=tmpdir)
        result = await processor.process(io.BytesIO(b"data"), "my-cv.pdf")
        assert result["stored_filename"] != "my-cv.pdf"
        assert result["stored_filename"].endswith(".pdf")


@pytest.mark.asyncio
async def test_passthrough_falls_back_mime_for_unknown_type():
    with tempfile.TemporaryDirectory() as tmpdir:
        processor = FilePassthroughProcessor(upload_dir=tmpdir)
        result = await processor.process(
            io.BytesIO(b"\x00\x01\x02"), "unknown.unknownextension"
        )
        assert result["mime_type"] == "application/octet-stream"
