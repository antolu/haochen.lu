from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, field_validator


class FileResponse(BaseModel):
    id: UUID
    original_name: str
    url: str
    mime_type: str
    file_size: int
    created_at: datetime

    @field_validator("id", mode="before")
    @classmethod
    def coerce_uuid(cls, v: object) -> str:
        return str(v)

    model_config = {"from_attributes": True}


class FileUpdate(BaseModel):
    original_name: str
