from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ApplicationReorderItem(BaseModel):
    id: str | UUID
    order: int


class ApplicationReorderRequest(BaseModel):
    items: list[ApplicationReorderItem]
    normalize: bool = False


class ApplicationBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str
    admin_url: str | None = None
    is_external: bool = False
    requires_auth: bool = True
    admin_only: bool = False
    enabled: bool = True
    order: int = 0
    client_id: str | None = None
    client_secret: str | None = None
    redirect_uris: str | None = None


class ApplicationCreate(ApplicationBase):
    slug: str | None = None


class ApplicationUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    url: str | None = None
    admin_url: str | None = None
    requires_auth: bool | None = None
    admin_only: bool | None = None
    client_id: str | None = None
    client_secret: str | None = None
    redirect_uris: str | None = None
    enabled: bool | None = None
    order: int | None = None


class ApplicationResponse(ApplicationBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    created_at: datetime
    updated_at: datetime


class ApplicationListResponse(BaseModel):
    applications: list[ApplicationResponse]
    total: int
