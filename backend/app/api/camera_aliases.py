from __future__ import annotations

import uuid
from math import ceil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models.camera_alias import CameraAlias
from app.models.photo import Photo
from app.schemas.camera_alias import (
    CameraAliasCreate,
    CameraAliasListResponse,
    CameraAliasResponse,
    CameraAliasUpdate,
    CameraDiscoveryItem,
    CameraDiscoveryResponse,
)

router = APIRouter()

# Module-level dependency variables to avoid B008
db_dependency = Depends(get_session)


@router.get("", response_model=CameraAliasListResponse)
async def list_camera_aliases(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search in original or display name"),
    brand: str | None = Query(None, description="Filter by brand"),
    *,
    is_active: bool | None = Query(default=None, description="Filter by active status"),
    db: AsyncSession = db_dependency,
) -> CameraAliasListResponse:
    """List camera aliases with pagination and filtering."""

    # Build base query
    query = select(CameraAlias)
    conditions: list[Any] = []

    if search:
        search_term = f"%{search}%"
        conditions.append(
            (CameraAlias.original_name.ilike(search_term))
            | (CameraAlias.display_name.ilike(search_term))
        )

    if brand:
        conditions.append(CameraAlias.brand.ilike(f"%{brand}%"))

    if is_active is not None:
        conditions.append(CameraAlias.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    # Get total count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Apply pagination and ordering
    query = query.order_by(
        CameraAlias.brand, CameraAlias.model, CameraAlias.original_name
    )
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    aliases = result.scalars().all()

    return CameraAliasListResponse(
        aliases=[CameraAliasResponse.model_validate(alias) for alias in aliases],
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 0,
    )


@router.post("", response_model=CameraAliasResponse)
async def create_camera_alias(
    alias_data: CameraAliasCreate,
    db: AsyncSession = db_dependency,
) -> CameraAliasResponse:
    """Create a new camera alias."""

    # Check if alias already exists for this original name
    existing = await db.execute(
        select(CameraAlias).where(CameraAlias.original_name == alias_data.original_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Alias already exists for camera '{alias_data.original_name}'",
        )

    alias = CameraAlias(id=uuid.uuid4(), **alias_data.model_dump())

    db.add(alias)
    await db.commit()
    await db.refresh(alias)

    return CameraAliasResponse.model_validate(alias)


@router.get("/{alias_id}", response_model=CameraAliasResponse)
async def get_camera_alias(
    alias_id: uuid.UUID,
    db: AsyncSession = db_dependency,
) -> CameraAliasResponse:
    """Get a specific camera alias by ID."""

    result = await db.execute(select(CameraAlias).where(CameraAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Camera alias not found")

    return CameraAliasResponse.model_validate(alias)


@router.put("/{alias_id}", response_model=CameraAliasResponse)
async def update_camera_alias(
    alias_id: uuid.UUID,
    alias_data: CameraAliasUpdate,
    db: AsyncSession = db_dependency,
) -> CameraAliasResponse:
    """Update a camera alias."""

    result = await db.execute(select(CameraAlias).where(CameraAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Camera alias not found")

    # Update fields
    update_data = alias_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alias, field, value)

    await db.commit()
    await db.refresh(alias)

    return CameraAliasResponse.model_validate(alias)


@router.delete("/{alias_id}")
async def delete_camera_alias(
    alias_id: uuid.UUID,
    db: AsyncSession = db_dependency,
) -> dict[str, str]:
    """Delete a camera alias."""

    result = await db.execute(select(CameraAlias).where(CameraAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Camera alias not found")

    await db.delete(alias)
    await db.commit()

    return {"message": "Camera alias deleted successfully"}


@router.get("/discover/cameras", response_model=CameraDiscoveryResponse)
async def discover_cameras(
    db: AsyncSession = db_dependency,
) -> CameraDiscoveryResponse:
    """Discover unique cameras from photos that don't have aliases yet."""

    # Get unique camera combinations from photos
    camera_query = (
        select(
            func.concat(Photo.camera_make, " ", Photo.camera_model).label(
                "original_name"
            ),
            Photo.camera_make,
            Photo.camera_model,
            func.count().label("photo_count"),
        )
        .where(
            and_(
                Photo.camera_make.is_not(None),
                Photo.camera_model.is_not(None),
                Photo.camera_make,
                Photo.camera_model,
            )
        )
        .group_by(Photo.camera_make, Photo.camera_model)
    )

    camera_result = await db.execute(camera_query)
    cameras_data = camera_result.all()

    # Get existing aliases to mark which cameras already have them
    alias_query = select(CameraAlias.original_name)
    alias_result = await db.execute(alias_query)
    existing_aliases = {alias[0] for alias in alias_result.all()}

    # Build response
    cameras = []
    total_photos = 0

    for camera_data in cameras_data:
        original_name = camera_data.original_name.strip()
        if original_name:  # Skip empty names
            cameras.append(
                CameraDiscoveryItem(
                    original_name=original_name,
                    camera_make=camera_data.camera_make,
                    camera_model=camera_data.camera_model,
                    photo_count=camera_data.photo_count,
                    has_alias=original_name in existing_aliases,
                )
            )
            total_photos += camera_data.photo_count

    # Sort by photo count descending (most used cameras first)
    cameras.sort(key=lambda x: x.photo_count, reverse=True)

    return CameraDiscoveryResponse(
        cameras=cameras, total_unique_cameras=len(cameras), total_photos=total_photos
    )
