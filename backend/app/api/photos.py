from __future__ import annotations

import math
import time
import uuid
from typing import Annotated, Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.file_access import file_access_controller
from app.core.image_processor import image_processor
from app.core.rate_limiter import FileAccessRateLimiter
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
from app.dependencies import (
    _current_admin_user_dependency,
    _current_user_optional_dependency,
    _image_file_dependency,
    _session_dependency,
)
from app.models.camera_alias import CameraAlias
from app.models.hero_image import HeroImage
from app.models.lens_alias import LensAlias
from app.models.photo import Photo as PhotoModel
from app.schemas.photo import (
    PhotoCreate,
    PhotoListResponse,
    PhotoLocationResponse,
    PhotoLocationsResponse,
    PhotoReorderRequest,
    PhotoResponse,
    PhotoUpdate,
)
from app.services.alias_service import AliasService
from app.types.access_control import FileType

router = APIRouter()


async def _create_aliases_for_photo(
    db: AsyncSession, photo: PhotoModel, *, skip_hero_check: bool = False
) -> None:
    """Auto-create camera and lens aliases for a new photo if they don't exist."""

    if not skip_hero_check:
        hero_reference = await db.execute(
            select(HeroImage.id).where(HeroImage.photo_id == photo.id)
        )
        if hero_reference.scalar_one_or_none():
            return

    # Create camera alias if camera info exists
    if photo.camera_make and photo.camera_model:
        original_name = f"{photo.camera_make} {photo.camera_model}".strip()
        if original_name:
            # Check if alias already exists
            existing = await db.execute(
                select(CameraAlias).where(CameraAlias.original_name == original_name)
            )
            if not existing.scalar_one_or_none():
                # Create new camera alias
                camera_alias = CameraAlias(
                    id=uuid.uuid4(),
                    original_name=original_name,
                    display_name=original_name,  # Default to same as original
                    brand=photo.camera_make,
                    model=photo.camera_model,
                    is_active=True,
                )
                db.add(camera_alias)

    # Create lens alias if lens info exists
    if photo.lens:
        original_name = photo.lens.strip()
        if original_name:
            # Check if alias already exists
            existing = await db.execute(
                select(LensAlias).where(LensAlias.original_name == original_name)
            )
            if not existing.scalar_one_or_none():
                # Create new lens alias
                lens_alias = LensAlias(
                    id=uuid.uuid4(),
                    original_name=original_name,
                    display_name=original_name,  # Default to same as original
                    is_active=True,
                )
                db.add(lens_alias)

    await db.commit()


def populate_photo_urls(photo_dict: dict, photo_id: str) -> dict:
    """Add secure API URLs to photo response."""
    # Add original file URL
    photo_dict["original_url"] = f"/api/photos/{photo_id}/file"
    photo_dict["download_url"] = f"/api/photos/{photo_id}/download"

    # Add variant URLs
    if photo_dict.get("variants"):
        for variant_name, variant_data in photo_dict["variants"].items():
            variant_data["url"] = f"/api/photos/{photo_id}/file/{variant_name}"

    return photo_dict


@router.get("", response_model=PhotoListResponse)
async def list_photos(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    category: str | None = Query(None, max_length=100),
    *,
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
    db: AsyncSession = _session_dependency,
) -> PhotoListResponse:
    """List photos with pagination and filtering."""

    if (near_lat is None) != (near_lon is None):
        raise HTTPException(
            status_code=422,
            detail="Both near_lat and near_lon must be provided for proximity search",
        )

    hero_photo_ids_result = await db.execute(select(HeroImage.photo_id))
    hero_photo_ids = {
        row[0] for row in hero_photo_ids_result.all() if row[0] is not None
    }

    effective_order = order_by if order_by != "order" else "order"
    skip = (page - 1) * per_page

    photos_query = await get_photos(
        db,
        skip=skip,
        limit=per_page,
        category=category,
        featured=featured,
        has_location=has_location,
        near_lat=near_lat,
        near_lon=near_lon,
        radius=radius,
        order_by=effective_order,
        exclude_photo_ids=hero_photo_ids,
    )

    total = await get_photo_count(
        db,
        category=category,
        featured=featured,
        has_location=has_location,
        near_lat=near_lat,
        near_lon=near_lon,
        radius=radius,
        exclude_photo_ids=hero_photo_ids,
    )
    pages = math.ceil(total / per_page)

    alias_service = AliasService(db)

    photo_responses = []
    for photo in photos_query:
        photo_dict = PhotoResponse.model_validate(photo).model_dump()
        photo_dict["camera_display_name"] = await alias_service.get_camera_display_name(
            getattr(photo, "camera_make", None), getattr(photo, "camera_model", None)
        )
        photo_dict["lens_display_name"] = await alias_service.get_lens_display_name(
            getattr(photo, "lens", None)
        )
        photo_dict = populate_photo_urls(photo_dict, str(photo.id))
        photo_responses.append(PhotoResponse.model_validate(photo_dict))

    return PhotoListResponse(
        photos=photo_responses,
        page=page,
        per_page=per_page,
        total=total,
        pages=pages,
    )


@router.get("/featured", response_model=list[PhotoResponse])
async def list_featured_photos(limit: int = 10, db: AsyncSession = _session_dependency):
    """Get featured photos."""
    photos = await get_photos(db, limit=limit, featured=True)

    # Resolve display names for camera and lens aliases
    alias_service = AliasService(db)

    # Convert photos to response objects with display names and URLs
    photo_responses = []
    for photo in photos:
        photo_dict = PhotoResponse.model_validate(photo).model_dump()

        # Add display names
        photo_dict["camera_display_name"] = await alias_service.get_camera_display_name(
            getattr(photo, "camera_make", None), getattr(photo, "camera_model", None)
        )
        photo_dict["lens_display_name"] = await alias_service.get_lens_display_name(
            getattr(photo, "lens", None)
        )

        # Add secure URLs
        photo_dict = populate_photo_urls(photo_dict, str(photo.id))

        photo_responses.append(PhotoResponse.model_validate(photo_dict))

    return photo_responses


@router.get("/tags", response_model=list[str])
async def list_distinct_tags(db: AsyncSession = _session_dependency):
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


@router.get("/locations", response_model=PhotoLocationsResponse)
async def get_photo_locations(
    db: AsyncSession = _session_dependency,
):
    """Get all photos with valid location data for map display."""
    # Query photos with valid coordinates
    result = await db.execute(
        select(PhotoModel)
        .where(
            and_(
                PhotoModel.location_lat.is_not(None),
                PhotoModel.location_lon.is_not(None),
            )
        )
        .order_by(PhotoModel.created_at.desc())
    )
    photos = result.scalars().all()

    # Convert to location response format
    locations = []
    for photo in photos:
        # Use secure API URLs for thumbnail
        thumbnail_url = None
        if photo.variants and isinstance(photo.variants, dict):
            if "thumbnail" in photo.variants:
                thumbnail_url = f"/api/photos/{photo.id}/file/thumbnail"
            elif "small" in photo.variants:
                thumbnail_url = f"/api/photos/{photo.id}/file/small"

        if not thumbnail_url:
            thumbnail_url = f"/api/photos/{photo.id}/file"

        location = PhotoLocationResponse(
            id=str(photo.id),
            title=str(photo.title),
            location_lat=float(photo.location_lat),
            location_lon=float(photo.location_lon),
            thumbnail_url=str(thumbnail_url) if thumbnail_url else None,
        )
        locations.append(location)

    return PhotoLocationsResponse(locations=locations, total=len(locations))


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo_detail(
    photo_id: UUID,
    *,
    increment_views: bool = True,
    db: AsyncSession = _session_dependency,
):
    """Get photo details and optionally increment view count."""
    photo = await get_photo(db, photo_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    if increment_views:
        await increment_view_count(db, photo_id)
        await db.refresh(photo)

    # Resolve display names for camera and lens aliases
    alias_service = AliasService(db)
    photo_dict = PhotoResponse.model_validate(photo).model_dump()

    # Add display names
    photo_dict["camera_display_name"] = await alias_service.get_camera_display_name(
        getattr(photo, "camera_make", None), getattr(photo, "camera_model", None)
    )
    photo_dict["lens_display_name"] = await alias_service.get_lens_display_name(
        getattr(photo, "lens", None)
    )

    # Add secure URLs
    photo_dict = populate_photo_urls(photo_dict, str(photo.id))

    return PhotoResponse.model_validate(photo_dict)


@router.post("", response_model=PhotoResponse)
async def upload_photo(
    file: UploadFile = _image_file_dependency,
    title: Annotated[str, Form()] = "",
    description: Annotated[str, Form()] = "",
    category: Annotated[str, Form()] = "",
    tags: Annotated[str, Form()] = "",
    comments: Annotated[str, Form()] = "",
    *,
    featured: Annotated[bool, Form()] = False,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
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

        # Auto-create aliases for camera and lens if they don't exist
        await _create_aliases_for_photo(db, photo)

        # Add secure URLs to response
        photo_dict = PhotoResponse.model_validate(photo).model_dump()
        photo_dict = populate_photo_urls(photo_dict, str(photo.id))

        return PhotoResponse.model_validate(photo_dict)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {e!s}"
        ) from e


@router.put("/{photo_id}", response_model=PhotoResponse)
async def update_photo_endpoint(
    photo_id: UUID,
    photo_update: PhotoUpdate,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Update photo metadata (admin only)."""
    photo = await update_photo(db, photo_id, photo_update)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Add secure URLs to response
    photo_dict = PhotoResponse.model_validate(photo).model_dump()
    photo_dict = populate_photo_urls(photo_dict, str(photo.id))

    return PhotoResponse.model_validate(photo_dict)


@router.delete("/{photo_id}")
async def delete_photo_endpoint(
    photo_id: UUID,
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
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
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Bulk reorder photos (admin only)."""
    # Convert to simple dicts for the crud layer
    items = [{"id": i.id, "order": i.order} for i in payload.items]
    await bulk_reorder_photos(db, items, normalize=payload.normalize)
    return {"message": "Reordered successfully"}


@router.get("/stats/summary")
async def get_photo_stats(
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,
):
    """Get photo statistics (admin only)."""
    total_photos = await get_photo_count(db)
    featured_photos = await get_photo_count(db, featured=True)

    return {
        "total_photos": total_photos,
        "featured_photos": featured_photos,
        "categories": {},  # Can be implemented later
    }


@router.get("/{photo_id}/file")
async def serve_photo_original(
    photo_id: UUID,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: Any | None = _current_user_optional_dependency,
    expires: int | None = Query(None, description="Temporary URL expiration timestamp"),
    signature: str | None = Query(None, description="Temporary URL signature"),
):
    """Serve original photo file with access control."""
    # Check if using temporary URL
    if expires and signature:
        if not file_access_controller.validate_temporary_url(
            photo_id, FileType.ORIGINAL, expires, signature
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired temporary URL",
            )
    else:
        # Regular access control
        photo = await file_access_controller.validate_photo_access(
            db,
            photo_id,
            FileType.ORIGINAL,
            user_id=str(current_user.id) if current_user else None,
            is_admin=current_user.is_admin if current_user else False,
        )

    # Get client ID for rate limiting
    client_id = (
        f"user:{current_user.id}" if current_user else f"ip:{request.client.host}"
    )

    # Check rate limits
    if not await FileAccessRateLimiter.check_download_limit(client_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Download rate limit exceeded",
        )

    # Get photo and file path
    if not (expires and signature):
        photo = await get_photo(db, photo_id)
    file_path = file_access_controller.get_file_path(photo, FileType.ORIGINAL)

    # Record access
    # Return file
    content_type = file_access_controller.get_content_type(file_path)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{photo_id}/file/{variant}")
async def serve_photo_variant(
    photo_id: UUID,
    variant: str,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: Any | None = _current_user_optional_dependency,
    expires: int | None = Query(None, description="Temporary URL expiration timestamp"),
    signature: str | None = Query(None, description="Temporary URL signature"),
):
    """Serve photo variant with access control."""
    # Validate variant
    try:
        file_type = FileType(variant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variant '{variant}'",
        ) from e

    # Check if using temporary URL
    if expires and signature:
        if not file_access_controller.validate_temporary_url(
            photo_id, file_type, expires, signature
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or expired temporary URL",
            )
    else:
        # Regular access control
        photo = await file_access_controller.validate_photo_access(
            db,
            photo_id,
            file_type,
            user_id=str(current_user.id) if current_user else None,
            is_admin=current_user.is_admin if current_user else False,
        )

    # Get client ID for rate limiting

    # Get photo and file path
    if not (expires and signature):
        photo = await get_photo(db, photo_id)
    file_path = file_access_controller.get_file_path(photo, file_type)

    # Record access
    # Return file
    content_type = file_access_controller.get_content_type(file_path)
    cache_control = (
        "public, max-age=86400"
        if file_type in [FileType.THUMBNAIL, FileType.SMALL]
        else "private, max-age=3600"
    )

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": cache_control},
    )


@router.get("/{photo_id}/download")
async def download_photo_original(
    photo_id: UUID,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: Any | None = _current_user_optional_dependency,
):
    """Download original photo file (forces download with proper filename)."""
    # Validate access
    photo = await file_access_controller.validate_photo_access(
        db,
        photo_id,
        FileType.ORIGINAL,
        user_id=str(current_user.id) if current_user else None,
        is_admin=current_user.is_admin if current_user else False,
    )

    # Get client ID for rate limiting
    client_id = (
        f"user:{current_user.id}" if current_user else f"ip:{request.client.host}"
    )

    # Check download rate limits (stricter for downloads)
    if not await FileAccessRateLimiter.check_download_limit(
        client_id, limit=5, period=300
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Download rate limit exceeded. Max 5 downloads per 5 minutes.",
        )

    # Get file path
    file_path = file_access_controller.get_file_path(photo, FileType.ORIGINAL)

    # Get download filename
    download_filename = file_access_controller.get_download_filename(
        photo, FileType.ORIGINAL
    )

    # Record access
    # Return file with download headers
    content_type = file_access_controller.get_content_type(file_path)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f'attachment; filename="{download_filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/{photo_id}/download/{variant}")
async def download_photo_variant(
    photo_id: UUID,
    variant: str,
    request: Request,
    db: AsyncSession = _session_dependency,
    current_user: Any | None = _current_user_optional_dependency,
):
    """Download photo variant (forces download with proper filename)."""
    # Validate variant
    try:
        file_type = FileType(variant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variant '{variant}'",
        ) from e

    # Validate access
    photo = await file_access_controller.validate_photo_access(
        db,
        photo_id,
        file_type,
        user_id=str(current_user.id) if current_user else None,
        is_admin=current_user.is_admin if current_user else False,
    )

    # Get client ID for rate limiting
    client_id = (
        f"user:{current_user.id}" if current_user else f"ip:{request.client.host}"
    )

    # Check download rate limits
    if not await FileAccessRateLimiter.check_download_limit(
        client_id, limit=10, period=300
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Download rate limit exceeded. Max 10 downloads per 5 minutes.",
        )

    # Get file path
    file_path = file_access_controller.get_file_path(photo, file_type)

    # Get download filename
    download_filename = file_access_controller.get_download_filename(photo, file_type)

    # Record access
    # Return file with download headers
    content_type = file_access_controller.get_content_type(file_path)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f'attachment; filename="{download_filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/{photo_id}/temporary-url/{variant}")
async def generate_temporary_url(
    photo_id: UUID,
    variant: str,
    expires_in: int = Query(
        3600, ge=60, le=86400, description="URL expires in seconds"
    ),
    db: AsyncSession = _session_dependency,
    current_user=_current_admin_user_dependency,  # Only admins can generate temp URLs
):
    """Generate temporary signed URL for photo access."""
    # Validate variant
    try:
        file_type = FileType(variant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variant '{variant}'",
        ) from e

    # Validate photo exists
    photo = await get_photo(db, photo_id)
    if not photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Photo not found"
        )

    # Generate temporary URL
    temp_url = file_access_controller.generate_temporary_url(
        photo_id, file_type, expires_in
    )

    return {
        "url": temp_url,
        "expires_in": expires_in,
        "expires_at": int(time.time()) + expires_in,
    }
