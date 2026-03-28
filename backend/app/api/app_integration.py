from __future__ import annotations

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.application import get_application_by_slug
from app.dependencies import (
    _current_admin_user_dependency,
    _session_dependency,
)
from app.models.user import User
from app.schemas.app_config import (
    AppConfig,
    AppConfigValidationResponse,
    AppIntegrationRequest,
    AppIntegrationResponse,
)

router = APIRouter()


def parse_yaml_safely(yaml_content: str) -> tuple[dict | None, list[str]]:
    """Parse YAML content safely and return parsed data and errors."""
    errors = []

    try:
        data = yaml.safe_load(yaml_content)

        if data is None:
            errors.append("YAML content is empty")
            return None, errors

        if not isinstance(data, dict):
            errors.append("YAML must contain a dictionary/object at root level")
            return None, errors

    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML syntax: {e!s}")
        return None, errors
    except Exception as e:
        errors.append(f"Failed to parse YAML: {e!s}")
        return None, errors
    else:
        return data, errors


def validate_app_config(
    data: dict,
) -> tuple[AppConfig | None, list[str], list[str]]:
    """Validate parsed YAML data against AppConfig schema."""
    errors = []
    warnings = []

    try:
        config = AppConfig(**data)

        slug = config.meta.slug
        if slug in ["admin", "api", "static", "uploads"]:
            errors.append(f"Slug '{slug}' is reserved and cannot be used")

        for image_field in ["backend_image", "frontend_image"]:
            image = getattr(config.docker, image_field)
            if ":" not in image:
                warnings.append(
                    f"{image_field} should include a tag (e.g., {image}:latest)"
                )

        warnings.extend(
            f"Environment variable '{env_var}' should use format 'KEY=value' or '${{VAR}}'"
            for env_var in config.docker.environment
            if "=" not in env_var and not env_var.startswith("${")
        )

    except ValidationError as e:
        for error in e.errors():
            field_path = " -> ".join(str(x) for x in error["loc"])
            errors.append(f"{field_path}: {error['msg']}")
        return None, errors, warnings
    except Exception as e:
        errors.append(f"Validation error: {e!s}")
        return None, errors, warnings
    else:
        return config, errors, warnings


@router.post("/validate", response_model=AppConfigValidationResponse)
async def validate_app_config_endpoint(
    request: AppIntegrationRequest,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> AppConfigValidationResponse:
    """Validate application YAML configuration."""

    data, parse_errors = parse_yaml_safely(request.yaml_content)

    if parse_errors:
        return AppConfigValidationResponse(valid=False, errors=parse_errors)

    config, validation_errors, warnings = (
        validate_app_config(data) if data else (None, [], [])
    )

    if config and not validation_errors:
        existing_application = await get_application_by_slug(db, config.meta.slug)
        if existing_application:
            validation_errors.append(
                f"An application with slug '{config.meta.slug}' already exists"
            )

    all_errors = parse_errors + validation_errors

    return AppConfigValidationResponse(
        valid=len(all_errors) == 0,
        errors=all_errors,
        warnings=warnings,
        config=config if len(all_errors) == 0 else None,
    )


@router.post("/integrate")
async def integrate_application(
    request: AppIntegrationRequest,
    db: AsyncSession = _session_dependency,
    current_user: User = _current_admin_user_dependency,
) -> AppConfigValidationResponse | AppIntegrationResponse:
    """Integrate a new application from YAML configuration."""

    if request.validate_only:
        result: AppConfigValidationResponse = await validate_app_config_endpoint(
            request, db, current_user
        )
        return result

    validation_result = await validate_app_config_endpoint(request, db, current_user)

    if not validation_result.valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Configuration validation failed",
                "errors": validation_result.errors,
            },
        )

    config = validation_result.config
    if config is None:
        raise HTTPException(
            status_code=400, detail="Validated configuration is missing"
        )

    # TODO: Implementation for actual integration
    # This would involve:
    # 1. Creating database entries
    # 2. Generating docker-compose additions
    # 3. Updating nginx configuration
    # 4. Deploying containers

    return AppIntegrationResponse(
        success=True,
        message=f"Application '{config.meta.name}' integrated successfully",
        slug=config.meta.slug,
        frontend_url=config.integration.frontend_path,
        api_url=config.integration.api_path,
        admin_url=f"/admin/applications/{config.meta.slug}"
        if config.integration.has_admin
        else None,
    )
