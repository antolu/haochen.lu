from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class SubAppMeta(BaseModel):
    name: str = Field(..., description="Human-readable name of the subapp")
    slug: str = Field(..., description="URL-safe identifier", pattern=r"^[a-z0-9-]+$")
    description: str = Field(..., description="Brief description of the subapp")
    version: str = Field(..., description="Version of the subapp")

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v):
        if len(v) < 2 or len(v) > 50:
            msg = "Slug must be between 2 and 50 characters"
            raise ValueError(msg)
        return v


class SubAppUI(BaseModel):
    icon: str = Field(..., description="Emoji or icon identifier")
    color: str = Field(..., description="Hex color code", pattern=r"^#[0-9A-Fa-f]{6}$")


class SubAppIntegration(BaseModel):
    frontend_path: str = Field(
        ..., description="Frontend route path", pattern=r"^/[a-z0-9-/]*$"
    )
    api_path: str = Field(
        ..., description="API route path", pattern=r"^/api/[a-z0-9-/]*$"
    )
    admin_path: str | None = Field(None, description="Admin route path")

    requires_auth: bool = Field(default=True, description="Requires authentication")
    admin_only: bool = Field(default=False, description="Admin-only access")
    show_in_menu: bool = Field(default=True, description="Show in navigation menu")
    menu_order: int = Field(default=10, description="Menu ordering", ge=0, le=100)

    has_admin: bool = Field(default=False, description="Has admin interface")
    admin_iframe: bool = Field(default=True, description="Use iframe for admin")
    admin_title: str = Field(default="", description="Admin section title")


class SubAppDockerEnvironment(BaseModel):
    environment: list[str] = Field(
        default_factory=list, description="Environment variables"
    )
    volumes: list[str] = Field(default_factory=list, description="Volume mounts")
    depends_on: list[str] = Field(
        default_factory=list, description="Service dependencies"
    )


class SubAppDocker(BaseModel):
    backend_image: str = Field(..., description="Docker image for backend")
    frontend_image: str = Field(..., description="Docker image for frontend")
    backend_port: int = Field(
        default=8000, description="Backend port", ge=1000, le=65535
    )
    redis_db: int = Field(default=0, description="Redis database number", ge=0, le=15)
    environment: list[str] = Field(default_factory=list)
    volumes: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)


class SubAppRouteConfig(BaseModel):
    location: str = Field(..., description="Nginx location pattern")
    proxy_pass: str = Field(..., description="Proxy target")


class SubAppRouting(BaseModel):
    frontend: SubAppRouteConfig
    api: SubAppRouteConfig
    admin: SubAppRouteConfig | None = None


class SubAppDatabase(BaseModel):
    db_schema: str | None = Field(None, description="Database schema name")
    migrations: bool = Field(default=False, description="Has migrations")


class SubAppConfig(BaseModel):
    meta: SubAppMeta
    ui: SubAppUI
    integration: SubAppIntegration
    docker: SubAppDocker
    routing: SubAppRouting
    database: SubAppDatabase | None = None

    @field_validator("integration")
    @classmethod
    def validate_integration_paths(cls, v, info):
        """Validate that paths are consistent with meta.slug"""
        if hasattr(info.data, "get") and info.data.get("meta"):
            slug = info.data["meta"].slug

            # Check that paths include the slug
            if not v.frontend_path.startswith(f"/{slug}"):
                msg = f"frontend_path must start with /{slug}"
                raise ValueError(msg)

            if not v.api_path.startswith(f"/api/{slug}"):
                msg = f"api_path must start with /api/{slug}"
                raise ValueError(msg)

        return v

    @field_validator("routing")
    @classmethod
    def validate_routing_consistency(cls, v, info):
        """Validate that routing matches integration paths"""
        if hasattr(info.data, "get") and info.data.get("integration"):
            integration = info.data["integration"]

            # Check frontend routing
            if not v.frontend.location.startswith(integration.frontend_path):
                msg = "Frontend routing location must match integration frontend_path"
                raise ValueError(msg)

            # Check API routing
            if not v.api.location.startswith(integration.api_path):
                msg = "API routing location must match integration api_path"
                raise ValueError(msg)

        return v


class SubAppConfigValidationResponse(BaseModel):
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    config: SubAppConfig | None = None


class SubAppIntegrationRequest(BaseModel):
    yaml_content: str = Field(..., description="Raw YAML configuration")
    validate_only: bool = Field(
        default=False, description="Only validate, don't integrate"
    )
