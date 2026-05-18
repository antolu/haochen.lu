from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class FileListResponse(BaseModel):
    items: list[FileResponse]
    total: int


class FileResponse(BaseModel):
    id: UUID
    original_name: str
    url: str
    mime_type: str
    file_size: int
    access_level: str
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    model_config = {"from_attributes": True}


class FileUpdate(BaseModel):
    original_name: str

    @field_validator("original_name")
    @classmethod
    def no_slashes(cls, v: str) -> str:
        if not v.strip():
            msg = "original_name cannot be empty"
            raise ValueError(msg)
        if "/" in v or "\\" in v:
            msg = "original_name cannot contain path separators"
            raise ValueError(msg)
        return v
