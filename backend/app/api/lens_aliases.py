from __future__ import annotations

import uuid
from math import ceil
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import _session_dependency
from app.models.lens_alias import LensAlias
from app.models.photo import Photo
from app.schemas.lens_alias import (
    LensAliasCreate,
    LensAliasListResponse,
    LensAliasResponse,
    LensAliasUpdate,
    LensDiscoveryItem,
    LensDiscoveryResponse,
)

router = APIRouter()


@router.get("", response_model=LensAliasListResponse)
async def list_lens_aliases(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(50, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search in original or display name"),
    brand: str | None = Query(None, description="Filter by brand"),
    mount_type: str | None = Query(None, description="Filter by mount type"),
    *,
    is_active: bool | None = Query(default=None, description="Filter by active status"),
    db: AsyncSession = _session_dependency,
) -> LensAliasListResponse:
    """List lens aliases with pagination and filtering."""

    # Build base query
    query = select(LensAlias)
    conditions: list[Any] = []

    if search:
        search_term = f"%{search}%"
        conditions.append(
            (LensAlias.original_name.ilike(search_term))
            | (LensAlias.display_name.ilike(search_term))
        )

    if brand:
        conditions.append(LensAlias.brand.ilike(f"%{brand}%"))

    if mount_type:
        conditions.append(LensAlias.mount_type.ilike(f"%{mount_type}%"))

    if is_active is not None:
        conditions.append(LensAlias.is_active == is_active)

    if conditions:
        query = query.where(and_(*conditions))

    # Get total count
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    # Apply pagination and ordering
    query = query.order_by(
        LensAlias.brand, LensAlias.focal_length, LensAlias.original_name
    )
    query = query.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    aliases = result.scalars().all()

    return LensAliasListResponse(
        aliases=[LensAliasResponse.model_validate(alias) for alias in aliases],
        total=total,
        page=page,
        per_page=per_page,
        pages=ceil(total / per_page) if total > 0 else 0,
    )


@router.post("", response_model=LensAliasResponse)
async def create_lens_alias(
    alias_data: LensAliasCreate,
    db: AsyncSession = _session_dependency,
) -> LensAliasResponse:
    """Create a new lens alias."""

    # Check if alias already exists for this original name
    existing = await db.execute(
        select(LensAlias).where(LensAlias.original_name == alias_data.original_name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail=f"Alias already exists for lens '{alias_data.original_name}'",
        )

    alias = LensAlias(id=uuid.uuid4(), **alias_data.model_dump())

    db.add(alias)
    await db.commit()
    await db.refresh(alias)

    return LensAliasResponse.model_validate(alias)


@router.get("/{alias_id}", response_model=LensAliasResponse)
async def get_lens_alias(
    alias_id: uuid.UUID,
    db: AsyncSession = _session_dependency,
) -> LensAliasResponse:
    """Get a specific lens alias by ID."""

    result = await db.execute(select(LensAlias).where(LensAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Lens alias not found")

    return LensAliasResponse.model_validate(alias)


@router.put("/{alias_id}", response_model=LensAliasResponse)
async def update_lens_alias(
    alias_id: uuid.UUID,
    alias_data: LensAliasUpdate,
    db: AsyncSession = _session_dependency,
) -> LensAliasResponse:
    """Update a lens alias."""

    result = await db.execute(select(LensAlias).where(LensAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Lens alias not found")

    # Update fields
    update_data = alias_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(alias, field, value)

    await db.commit()
    await db.refresh(alias)

    return LensAliasResponse.model_validate(alias)


@router.delete("/{alias_id}")
async def delete_lens_alias(
    alias_id: uuid.UUID,
    db: AsyncSession = _session_dependency,
) -> dict[str, str]:
    """Delete a lens alias."""

    result = await db.execute(select(LensAlias).where(LensAlias.id == alias_id))
    alias = result.scalar_one_or_none()

    if not alias:
        raise HTTPException(status_code=404, detail="Lens alias not found")

    await db.delete(alias)
    await db.commit()

    return {"message": "Lens alias deleted successfully"}


@router.get("/discover/lenses", response_model=LensDiscoveryResponse)
async def discover_lenses(
    db: AsyncSession = _session_dependency,
) -> LensDiscoveryResponse:
    """Discover unique lenses from photos that don't have aliases yet."""

    # Get unique lenses from photos
    lens_query = (
        select(Photo.lens.label("original_name"), func.count().label("photo_count"))
        .where(and_(Photo.lens.is_not(None), Photo.lens))
        .group_by(Photo.lens)
    )

    lens_result = await db.execute(lens_query)
    lenses_data = lens_result.all()

    # Get existing aliases to mark which lenses already have them
    alias_query = select(LensAlias.original_name)
    alias_result = await db.execute(alias_query)
    existing_aliases = {alias[0] for alias in alias_result.all()}

    # Build response
    lenses = []
    total_photos = 0

    for lens_data in lenses_data:
        original_name = lens_data.original_name.strip()
        if original_name:  # Skip empty names
            lenses.append(
                LensDiscoveryItem(
                    original_name=original_name,
                    photo_count=lens_data.photo_count,
                    has_alias=original_name in existing_aliases,
                )
            )
            total_photos += lens_data.photo_count

    # Sort by photo count descending (most used lenses first)
    lenses.sort(key=lambda x: x.photo_count, reverse=True)

    return LensDiscoveryResponse(
        lenses=lenses, total_unique_lenses=len(lenses), total_photos=total_photos
    )
