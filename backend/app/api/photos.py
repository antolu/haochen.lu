from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.image_processor import image_processor
from app.crud.photo import (
    bulk_reorder_photos,
    create_photo,
    delete_photo,
    get_photo,
    get_photo_count,
    get_photos,
    increment_view_count,
    update_photo,
)
from app.database import get_session
from app.dependencies import get_current_admin_user
from app.models.photo import Photo as PhotoModel
from app.schemas.photo import (
    PhotoCreate,
    PhotoListResponse,
    PhotoReorderRequest,
    PhotoResponse,
    PhotoUpdate,
)

router = APIRouter()


@router.get("", response_model=PhotoListResponse)
async def list_photos(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    category: str | None = Query(None, max_length=100),
    featured: bool | None = None,
    has_location: bool | None = None,
    near_lat: float | None = Query(
        None, ge=-90, le=90, description="Latitude for proximity search"
    ),
    near_lon: float | None = Query(
        None, ge=-180, le=180, description="Longitude for proximity search"
    ),
    radius: float = Query(
        10.0, ge=0.1, le=50.0, description="Search radius in kilometers"
    ),
    order_by: str = Query(
        "created_at", regex="^(created_at|date_taken|views|title|order)$"
    ),
    db: AsyncSession = Depends(get_session),
):
    """List photos with pagination and filtering."""
    # Validate proximity search parameters
    if (near_lat is None) != (near_lon is None):
        raise HTTPException(
            status_code=422,
            detail="Both near_lat and near_lon must be provided for proximity search",
        )

    skip = (page - 1) * per_page

    photos = await get_photos(
        db,
        skip=skip,
        limit=per_page,
        category=category,
        featured=featured,
        has_location=has_location,
        near_lat=near_lat,
        near_lon=near_lon,
        radius=radius,
        order_by=order_by,
    )

    total = await get_photo_count(
        db,
        category=category,
        featured=featured,
        has_location=has_location,
        near_lat=near_lat,
        near_lon=near_lon,
        radius=radius,
    )
    pages = math.ceil(total / per_page)

    return PhotoListResponse(
        photos=[PhotoResponse.model_validate(photo) for photo in photos],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.get("/featured", response_model=list[PhotoResponse])
async def list_featured_photos(
    limit: int = 10, db: AsyncSession = Depends(get_session)
):
    """Get featured photos."""
    photos = await get_photos(db, limit=limit, featured=True)
    return [PhotoResponse.model_validate(photo) for photo in photos]


@router.get("/tags", response_model=list[str])
async def list_distinct_tags(db: AsyncSession = Depends(get_session)):
    """Return a distinct, sorted list of tags across all photos."""
    # Fetch tags column for all photos (could paginate in large datasets)
    result = await db.execute(select(PhotoModel.tags))
    tag_strings = [row[0] for row in result.all() if row[0]]
    tags_set: set[str] = set()
    for s in tag_strings:
        for t in s.split(","):
            cleaned = t.strip()
            if cleaned:
                tags_set.add(cleaned)
    return sorted(tags_set, key=lambda x: x.lower())


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo_detail(
    photo_id: UUID,
    increment_views: bool = True,
    db: AsyncSession = Depends(get_session),
):
    """Get photo details and optionally increment view count."""
    photo = await get_photo(db, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if increment_views:
        await increment_view_count(db, photo_id)
        await db.refresh(photo)

    return PhotoResponse.model_validate(photo)


@router.post("", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = File(..., description="Image file to upload"),
    title: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    category: Annotated[str, Form()] = "",
    tags: Annotated[str, Form()] = "",
    comments: Annotated[str, Form()] = "",
    featured: Annotated[bool, Form()] = False,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Upload a new photo (admin only)."""

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Validate file size
    if file.size and file.size > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(
            status_code=400, detail="File too large. Maximum size is 50MB"
        )

    try:
        # Process image
        processed_data = await image_processor.process_image(
            file.file, file.filename or "image.jpg", title or file.filename
        )

        # Create photo record
        photo_data = PhotoCreate(
            title=title or file.filename or "Untitled",
            description=description,
            category=category,
            tags=tags,
            comments=comments,
            featured=featured,
        )

        photo = await create_photo(db, photo_data, **processed_data)
        return PhotoResponse.model_validate(photo)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {e!s}"
        ) from e


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo_endpoint(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Update photo metadata (admin only)."""
    photo = await update_photo(db, photo_id, photo_update)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    return PhotoResponse.model_validate(photo)


@router.delete("/{photo_id}")
async def delete_photo_endpoint(
    photo_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Delete photo (admin only)."""
    photo = await get_photo(db, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Delete files
    photo_data: dict = {
        "original_path": photo.original_path,
        "variants": photo.variants or {},
    }
    await image_processor.delete_image_files(photo_data)

    # Delete database record
    success = await delete_photo(db, photo_id)
    if not success:
        raise HTTPException(status_code=404, detail="Photo not found")

    return {"message": "Photo deleted successfully"}


@router.post("/reorder")
async def reorder_photos(
    payload: PhotoReorderRequest,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Bulk reorder photos (admin only)."""
    # Convert to simple dicts for the crud layer
    items = [{"id": i.id, "order": i.order} for i in payload.items]
    await bulk_reorder_photos(db, items, normalize=payload.normalize)
    return {"message": "Reordered successfully"}


@router.get("/stats/summary")
async def get_photo_stats(
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Get photo statistics (admin only)."""
    total_photos = await get_photo_count(db)
    featured_photos = await get_photo_count(db, featured=True)

    return {
        "total_photos": total_photos,
        "featured_photos": featured_photos,
        "categories": {},  # Can be implemented later
    }
