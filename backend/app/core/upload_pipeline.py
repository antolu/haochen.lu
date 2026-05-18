from __future__ import annotations

import asyncio
import logging
from typing import Any, Protocol, runtime_checkable

from fastapi import HTTPException, UploadFile, status

from app.config import settings

logger = logging.getLogger(__name__)

_upload_semaphore = asyncio.Semaphore(3)


@runtime_checkable
class ProcessorProtocol(Protocol):
    async def process(self, file: Any, filename: str) -> dict: ...


async def run_upload_pipeline(
    file: UploadFile,
    validator: Any,
    processor: ProcessorProtocol,
    *,
    max_retries: int = 3,
) -> dict[str, Any]:
    """Validate, size-check, and process an uploaded file.

    Returns the dict produced by processor.process().
    Raises HTTPException on validation failure, size excess, or processing failure.
    """
    async with _upload_semaphore:
        await validator.validate_file(file)

        max_size = getattr(validator, "max_size", settings.max_file_size)
        content = await file.read()
        if len(content) > max_size:
            max_mb = max_size / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {max_mb:.0f}MB",
            )
        await file.seek(0)

        filename = file.filename or "upload"
        last_error: Exception | None = None

        for attempt in range(max_retries):
            try:
                file.file.seek(0)
                return await processor.process(file.file, filename)
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Upload processing attempt %d/%d failed for %s: %s",
                    attempt + 1,
                    max_retries,
                    filename,
                    exc,
                )
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.5 * (attempt + 1))

        logger.error(
            "Upload processing failed after %d attempts: %s", max_retries, last_error
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Processing failed: {last_error!s}",
        )
