from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SubAppBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str
    admin_url: str | None = None
    is_external: bool = False
    requires_auth: bool = True
    admin_only: bool = False
    show_in_menu: bool = True
    enabled: bool = True
    order: int = 0
    client_id: str | None = None
    client_secret: str | None = None
    redirect_uris: str | None = None


class SubAppCreate(SubAppBase):
    slug: str | None = None


class SubAppUpdate(BaseModel):
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
    show_in_menu: bool | None = None
    order: int | None = None


class SubAppResponse(SubAppBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    created_at: datetime
    updated_at: datetime


class SubAppListResponse(BaseModel):
    subapps: list[SubAppResponse]
    total: int
