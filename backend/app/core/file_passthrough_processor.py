from __future__ import annotations

import asyncio
import mimetypes
import uuid
from pathlib import Path
from typing import Any, BinaryIO


class FilePassthroughProcessor:
    """Saves uploaded file as-is to disk under a UUID filename."""

    def __init__(self, upload_dir: str) -> None:
        self.upload_dir = Path(upload_dir).resolve()
        self.upload_dir.mkdir(exist_ok=True, parents=True)

    async def process(self, file: BinaryIO, filename: str) -> dict[str, Any]:
        file_id = str(uuid.uuid4())
        suffix = Path(filename).suffix.lower()
        stored_filename = f"{file_id}{suffix}"
        dest = self.upload_dir / stored_filename

        content = await asyncio.to_thread(file.read)
        dest.write_bytes(content)

        mime_type, _ = mimetypes.guess_type(filename)
        if mime_type is None:
            mime_type = "application/octet-stream"

        return {
            "original_name": filename,
            "stored_filename": stored_filename,
            "original_path": str(dest),
            "file_size": len(content),
            "mime_type": mime_type,
        }
