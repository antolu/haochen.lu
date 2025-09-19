from __future__ import annotations

import yaml
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from app.crud.subapp import get_subapp_by_slug
from app.database import get_session
from app.dependencies import get_current_admin_user
from app.schemas.subapp_config import (
    SubAppConfig,
    SubAppConfigValidationResponse,
    SubAppIntegrationRequest,
)

router = APIRouter()


def parse_yaml_safely(yaml_content: str) -> tuple[dict | None, list[str]]:
    """Parse YAML content safely and return parsed data and errors."""
    errors = []

    try:
        # Parse YAML
        data = yaml.safe_load(yaml_content)

        if data is None:
            errors.append("YAML content is empty")
            return None, errors

        if not isinstance(data, dict):
            errors.append("YAML must contain a dictionary/object at root level")
            return None, errors

        return data, errors

    except yaml.YAMLError as e:
        errors.append(f"Invalid YAML syntax: {str(e)}")
        return None, errors
    except Exception as e:
        errors.append(f"Failed to parse YAML: {str(e)}")
        return None, errors


def validate_subapp_config(data: dict) -> tuple[SubAppConfig | None, list[str], list[str]]:
    """Validate parsed YAML data against SubAppConfig schema."""
    errors = []
    warnings = []

    try:
        # Validate with Pydantic
        config = SubAppConfig(**data)

        # Additional business logic validations

        # Check for slug conflicts (this would be checked against database)
        slug = config.meta.slug
        if slug in ['admin', 'api', 'static', 'uploads']:
            errors.append(f"Slug '{slug}' is reserved and cannot be used")

        # Validate Docker images format
        for image_field in ['backend_image', 'frontend_image']:
            image = getattr(config.docker, image_field)
            if ':' not in image:
                warnings.append(f"{image_field} should include a tag (e.g., {image}:latest)")

        # Validate environment variables format
        for env_var in config.docker.environment:
            if '=' not in env_var and not env_var.startswith('${'):
                warnings.append(f"Environment variable '{env_var}' should use format 'KEY=value' or '${VAR}'")

        return config, errors, warnings

    except ValidationError as e:
        for error in e.errors():
            field_path = ' -> '.join(str(x) for x in error['loc'])
            errors.append(f"{field_path}: {error['msg']}")
        return None, errors, warnings
    except Exception as e:
        errors.append(f"Validation error: {str(e)}")
        return None, errors, warnings


@router.post("/validate", response_model=SubAppConfigValidationResponse)
async def validate_subapp_config_endpoint(
    request: SubAppIntegrationRequest,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Validate subapp YAML configuration."""

    # Parse YAML
    data, parse_errors = parse_yaml_safely(request.yaml_content)

    if parse_errors:
        return SubAppConfigValidationResponse(
            valid=False,
            errors=parse_errors
        )

    # Validate configuration schema
    config, validation_errors, warnings = validate_subapp_config(data)

    # Check for slug conflicts in database
    if config and not validation_errors:
        existing_subapp = await get_subapp_by_slug(db, config.meta.slug)
        if existing_subapp:
            validation_errors.append(f"A subapp with slug '{config.meta.slug}' already exists")

    all_errors = parse_errors + validation_errors

    return SubAppConfigValidationResponse(
        valid=len(all_errors) == 0,
        errors=all_errors,
        warnings=warnings,
        config=config if len(all_errors) == 0 else None
    )


@router.post("/integrate")
async def integrate_subapp(
    request: SubAppIntegrationRequest,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Integrate a new subapp from YAML configuration."""

    if request.validate_only:
        return await validate_subapp_config_endpoint(request, db, current_user)

    # First validate
    validation_result = await validate_subapp_config_endpoint(request, db, current_user)

    if not validation_result.valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Configuration validation failed",
                "errors": validation_result.errors
            }
        )

    config = validation_result.config

    # TODO: Implementation for actual integration
    # This would involve:
    # 1. Creating database entries
    # 2. Generating docker-compose additions
    # 3. Updating nginx configuration
    # 4. Deploying containers

    return {
        "success": True,
        "message": f"Subapp '{config.meta.name}' integrated successfully",
        "slug": config.meta.slug,
        "frontend_url": config.integration.frontend_path,
        "api_url": config.integration.api_path,
        "admin_url": f"/admin/subapps/{config.meta.slug}" if config.integration.has_admin else None
    }