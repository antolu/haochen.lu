from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, validator


class SubAppMeta(BaseModel):
    name: str = Field(..., description="Human-readable name of the subapp")
    slug: str = Field(..., description="URL-safe identifier", pattern=r"^[a-z0-9-]+$")
    description: str = Field(..., description="Brief description of the subapp")
    version: str = Field(..., description="Version of the subapp")

    @validator('slug')
    def validate_slug(cls, v):
        if len(v) < 2 or len(v) > 50:
            raise ValueError('Slug must be between 2 and 50 characters')
        return v


class SubAppUI(BaseModel):
    icon: str = Field(..., description="Emoji or icon identifier")
    color: str = Field(..., description="Hex color code", pattern=r"^#[0-9A-Fa-f]{6}$")


class SubAppIntegration(BaseModel):
    frontend_path: str = Field(..., description="Frontend route path", pattern=r"^/[a-z0-9-/]*$")
    api_path: str = Field(..., description="API route path", pattern=r"^/api/[a-z0-9-/]*$")
    admin_path: Optional[str] = Field(None, description="Admin route path")

    requires_auth: bool = Field(default=True, description="Requires authentication")
    admin_only: bool = Field(default=False, description="Admin-only access")
    show_in_menu: bool = Field(default=True, description="Show in navigation menu")
    menu_order: int = Field(default=10, description="Menu ordering", ge=0, le=100)

    has_admin: bool = Field(default=False, description="Has admin interface")
    admin_iframe: bool = Field(default=True, description="Use iframe for admin")
    admin_title: str = Field(default="", description="Admin section title")


class SubAppDockerEnvironment(BaseModel):
    environment: List[str] = Field(default_factory=list, description="Environment variables")
    volumes: List[str] = Field(default_factory=list, description="Volume mounts")
    depends_on: List[str] = Field(default_factory=list, description="Service dependencies")


class SubAppDocker(BaseModel):
    backend_image: str = Field(..., description="Docker image for backend")
    frontend_image: str = Field(..., description="Docker image for frontend")
    backend_port: int = Field(default=8000, description="Backend port", ge=1000, le=65535)
    redis_db: int = Field(default=0, description="Redis database number", ge=0, le=15)
    environment: List[str] = Field(default_factory=list)
    volumes: List[str] = Field(default_factory=list)
    depends_on: List[str] = Field(default_factory=list)


class SubAppRouteConfig(BaseModel):
    location: str = Field(..., description="Nginx location pattern")
    proxy_pass: str = Field(..., description="Proxy target")


class SubAppRouting(BaseModel):
    frontend: SubAppRouteConfig
    api: SubAppRouteConfig
    admin: Optional[SubAppRouteConfig] = None


class SubAppDatabase(BaseModel):
    schema: Optional[str] = Field(None, description="Database schema name")
    migrations: bool = Field(default=False, description="Has migrations")


class SubAppConfig(BaseModel):
    meta: SubAppMeta
    ui: SubAppUI
    integration: SubAppIntegration
    docker: SubAppDocker
    routing: SubAppRouting
    database: Optional[SubAppDatabase] = None

    @validator('integration')
    def validate_integration_paths(cls, v, values):
        """Validate that paths are consistent with meta.slug"""
        if 'meta' in values:
            slug = values['meta'].slug

            # Check that paths include the slug
            if not v.frontend_path.startswith(f"/{slug}"):
                raise ValueError(f"frontend_path must start with /{slug}")

            if not v.api_path.startswith(f"/api/{slug}"):
                raise ValueError(f"api_path must start with /api/{slug}")

        return v

    @validator('routing')
    def validate_routing_consistency(cls, v, values):
        """Validate that routing matches integration paths"""
        if 'integration' in values:
            integration = values['integration']

            # Check frontend routing
            if not v.frontend.location.startswith(integration.frontend_path):
                raise ValueError("Frontend routing location must match integration frontend_path")

            # Check API routing
            if not v.api.location.startswith(integration.api_path):
                raise ValueError("API routing location must match integration api_path")

        return v


class SubAppConfigValidationResponse(BaseModel):
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    config: Optional[SubAppConfig] = None


class SubAppIntegrationRequest(BaseModel):
    yaml_content: str = Field(..., description="Raw YAML configuration")
    validate_only: bool = Field(default=False, description="Only validate, don't integrate")