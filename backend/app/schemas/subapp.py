from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel


class SubAppBase(BaseModel):
    name: str
    description: str | None = None
    icon: str | None = None
    color: str | None = None
    url: str
    is_external: bool = False
    requires_auth: bool = True
    admin_only: bool = False
    show_in_menu: bool = True
    enabled: bool = True
    order: int = 0


class SubAppCreate(SubAppBase):
    slug: str | None = None


class SubAppUpdate(SubAppBase):
    name: str | None = None
    url: str | None = None
    enabled: bool | None = None


class SubAppResponse(SubAppBase):
    id: str
    slug: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SubAppListResponse(BaseModel):
    subapps: list[SubAppResponse]
    total: int