from __future__ import annotations

import uuid
from math import ceil

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import ColumnElement, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import _session_dependency
from app.models.lens_alias import LensAlias
from app.models.photo import Photo
from app.schemas.lens_alias import (
    LensAliasListResponse,
    LensAliasResponse,
    LensAliasUpdate,
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
    """List lens aliases auto-populated from uploaded photos."""

    # Auto-create aliases for lenses found in photos that don't have aliases yet
    await _ensure_lens_aliases_exist(db)

    # Build base query
    query = select(LensAlias)
    conditions: list[ColumnElement[bool]] = []

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


async def _ensure_lens_aliases_exist(db: AsyncSession) -> None:
    """Auto-create lens aliases for lenses found in photos that don't have aliases yet."""
    # Get unique lenses from photos
    lens_query = (
        select(Photo.lens)
        .where(
            and_(
                Photo.lens.is_not(None),
                func.length(func.trim(Photo.lens)) > 0,
            )
        )
        .distinct()
    )

    lens_result = await db.execute(lens_query)
    lenses_data = lens_result.scalars().all()

    # Get existing aliases
    alias_query = select(LensAlias.original_name)
    alias_result = await db.execute(alias_query)
    existing_aliases = {alias[0] for alias in alias_result.all()}

    # Create aliases for lenses that don't have them
    for lens_name in lenses_data:
        original_name = lens_name.strip()
        if original_name and original_name not in existing_aliases:
            alias = LensAlias(
                id=uuid.uuid4(),
                original_name=original_name,
                display_name=original_name,  # Default to same as original
                is_active=True,
            )
            db.add(alias)

    await db.commit()


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
