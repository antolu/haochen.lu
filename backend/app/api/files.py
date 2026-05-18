from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.file_passthrough_processor import FilePassthroughProcessor
from app.core.file_validation import FileValidator
from app.core.rate_limiter import FileAccessRateLimiter
from app.core.upload_pipeline import run_upload_pipeline
from app.crud.file import (
    create_file_record,
    delete_file_record,
    get_file_by_id,
    get_file_by_name,
    list_files,
    rename_file_record,
)
from app.dependencies import _current_admin_user_dependency, _session_dependency
from app.models.file import FileRecord
from app.models.user import User
from app.schemas.file import FileResponse as FileResponseSchema
from app.schemas.file import FileUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

_file_validator = FileValidator(
    allowed_extensions=None, max_size=settings.max_file_size
)


def _build_response(record: FileRecord, original_name: str) -> FileResponseSchema:
    data = {
        "id": str(record.id),
        "original_name": original_name,
        "url": f"/files/{original_name}",
        "mime_type": record.mime_type,
        "file_size": record.file_size,
        "created_at": record.created_at,
    }
    return FileResponseSchema.model_validate(data)


@router.post("", response_model=FileResponseSchema, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    *,
    replace: bool = Query(
        default=False, description="Replace existing file with same name"
    ),
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> FileResponseSchema:
    """Upload a file. Returns 409 if original_name already exists unless replace=true."""
    original_name = file.filename or "upload"

    existing = await get_file_by_name(db, original_name)
    if existing and not replace:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"conflict": True, "existing_id": str(existing.id)},
        )

    if existing and replace:
        disk_path = Path(existing.original_path)
        if disk_path.exists():
            disk_path.unlink()
        await delete_file_record(db, existing)

    processor = FilePassthroughProcessor(upload_dir=settings.file_upload_dir)
    processed = await run_upload_pipeline(file, _file_validator, processor)

    record = await create_file_record(
        db,
        original_name=original_name,
        stored_filename=processed["stored_filename"],
        original_path=processed["original_path"],
        mime_type=processed["mime_type"],
        file_size=processed["file_size"],
    )
    return _build_response(record, original_name)


@router.get("", response_model=list[FileResponseSchema])
async def list_files_endpoint(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    sort_by: str = Query("created_at", pattern="^(name|created_at|file_size)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> list[FileResponseSchema]:
    """List uploaded files (admin only)."""
    records, _ = await list_files(
        db, skip=skip, limit=limit, search=search, sort_by=sort_by, order=order
    )
    return [_build_response(r, r.original_name) for r in records]


@router.patch("/{file_id}", response_model=FileResponseSchema)
async def rename_file(
    file_id: UUID,
    body: FileUpdate,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> FileResponseSchema:
    """Rename a file (updates URL slug)."""
    record = await get_file_by_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    collision = await get_file_by_name(db, body.original_name)
    if collision and collision.id != file_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"conflict": True, "existing_id": str(collision.id)},
        )

    record = await rename_file_record(db, record, body.original_name)
    return _build_response(record, record.original_name)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> None:
    """Delete a file record and its disk file."""
    record = await get_file_by_id(db, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    disk_path = Path(record.original_path)
    if disk_path.exists():
        disk_path.unlink()

    await delete_file_record(db, record)


async def serve_public_file(
    filename: str, request: Request, db: AsyncSession
) -> FileResponse:
    """Serve a file by original_name. Rate limited."""
    client_ip = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
    client_id = f"ip:{client_ip}"

    if not await FileAccessRateLimiter.check_download_limit(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )

    record = await get_file_by_name(db, filename)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")

    disk_path = Path(record.original_path).resolve()
    upload_dir = Path(settings.file_upload_dir).resolve()
    try:
        disk_path.relative_to(upload_dir)
    except ValueError as e:
        raise HTTPException(status_code=403, detail="Access denied") from e

    if not disk_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(disk_path),
        media_type=record.mime_type,
        filename=record.original_name,
        headers={"Cache-Control": "public, max-age=3600"},
    )
