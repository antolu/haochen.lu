from __future__ import annotations

import io
from typing import Annotated, Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.file_access import file_access_controller
from app.core.image_processor import image_processor
from app.crud.profile_picture import (
    activate_profile_picture,
    create_profile_picture,
    delete_profile_picture,
    get_active_profile_picture,
    get_profile_picture,
    get_profile_picture_count,
    get_profile_pictures,
    update_profile_picture,
)
from app.database import get_session
from app.dependencies import get_current_admin_user, get_current_user_optional
from app.schemas.profile_picture import (
    ActiveProfilePictureResponse,
    ProfilePictureCreate,
    ProfilePictureListResponse,
    ProfilePictureResponse,
    ProfilePictureUpdate,
)
from app.types.access_control import FileType

router = APIRouter()


def _raise_invalid_dimensions() -> None:
    """Raise HTTPException for invalid image dimensions."""
    raise HTTPException(status_code=400, detail="Invalid image dimensions")


def _raise_not_square() -> None:
    """Raise HTTPException for non-square images."""
    raise HTTPException(
        status_code=400,
        detail=(
            "Profile pictures must be square (1:1). Please crop your image to a square."
        ),
    )


def populate_profile_picture_urls(
    profile_picture_dict: dict, profile_picture_id: str
) -> dict:
    """Add secure API URLs to profile picture response."""
    # Add original file URL
    profile_picture_dict["original_url"] = (
        f"/api/profile-pictures/{profile_picture_id}/file"
    )
    profile_picture_dict["download_url"] = (
        f"/api/profile-pictures/{profile_picture_id}/download"
    )

    # Add variant URLs
    if profile_picture_dict.get("variants"):
        for variant_name, variant_data in profile_picture_dict["variants"].items():
            variant_data["url"] = (
                f"/api/profile-pictures/{profile_picture_id}/file/{variant_name}"
            )

    return profile_picture_dict


@router.get("", response_model=ProfilePictureListResponse)
async def list_profile_pictures(
    page: int = 1,
    per_page: int = 20,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """List all profile pictures (admin only)."""
    skip = (page - 1) * per_page

    profile_pictures = await get_profile_pictures(db, skip=skip, limit=per_page)
    total = await get_profile_picture_count(db)

    # Convert to response objects with URLs
    profile_picture_responses = []
    for profile_picture in profile_pictures:
        profile_picture_dict = ProfilePictureResponse.model_validate(
            profile_picture
        ).model_dump()
        profile_picture_dict = populate_profile_picture_urls(
            profile_picture_dict, str(profile_picture.id)
        )
        profile_picture_responses.append(
            ProfilePictureResponse.model_validate(profile_picture_dict)
        )

    return ProfilePictureListResponse(
        profile_pictures=profile_picture_responses,
        total=total,
    )


@router.get("/active", response_model=ActiveProfilePictureResponse)
async def get_active_profile_picture_endpoint(
    db: AsyncSession = Depends(get_session),
):
    """Get the currently active profile picture (public endpoint)."""
    profile_picture = await get_active_profile_picture(db)

    if not profile_picture:
        return ActiveProfilePictureResponse(profile_picture=None)

    # Convert to response object with URLs
    profile_picture_dict = ProfilePictureResponse.model_validate(
        profile_picture
    ).model_dump()
    profile_picture_dict = populate_profile_picture_urls(
        profile_picture_dict, str(profile_picture.id)
    )

    return ActiveProfilePictureResponse(
        profile_picture=ProfilePictureResponse.model_validate(profile_picture_dict)
    )


@router.get("/{profile_picture_id}", response_model=ProfilePictureResponse)
async def get_profile_picture_detail(
    profile_picture_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Get profile picture details (admin only)."""
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Convert to response object with URLs
    profile_picture_dict = ProfilePictureResponse.model_validate(
        profile_picture
    ).model_dump()
    profile_picture_dict = populate_profile_picture_urls(
        profile_picture_dict, str(profile_picture.id)
    )

    return ProfilePictureResponse.model_validate(profile_picture_dict)


@router.post("", response_model=ProfilePictureResponse)
async def upload_profile_picture(
    file: UploadFile = File(..., description="Square image file to upload"),
    title: Annotated[str, Form()] = "",
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Upload a new profile picture (admin only). Image should be square and will be processed for optimal display."""

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Validate file size (smaller limit for profile pictures)
    if file.size and file.size > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(
            status_code=400, detail="File too large. Maximum size is 10MB"
        )

    try:
        # Read file content once to allow pre-validation and processing
        content_bytes = await file.read()

        # Pre-validate square aspect before any heavy processing
        try:
            with Image.open(io.BytesIO(content_bytes)) as im:
                w, h = im.size
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid image file") from e

        if w <= 0 or h <= 0:
            _raise_invalid_dimensions()

        aspect_ratio = w / h
        # Accept 0.95-1.05 (~5% tolerance)
        if not (0.95 <= aspect_ratio <= 1.05):
            _raise_not_square()

        # Process image using a fresh BytesIO since we've consumed the stream
        processed_data = await image_processor.process_image(
            io.BytesIO(content_bytes),
            file.filename or "profile.jpg",
            title or file.filename or "Profile Picture",
        )

        # Create profile picture record
        profile_picture_data = ProfilePictureCreate(
            title=title or "Profile Picture",
            is_active=False,  # Don't activate automatically
        )

        profile_picture = await create_profile_picture(
            db, profile_picture_data, **processed_data
        )

        # Add secure URLs to response
        profile_picture_dict = ProfilePictureResponse.model_validate(
            profile_picture
        ).model_dump()
        profile_picture_dict = populate_profile_picture_urls(
            profile_picture_dict, str(profile_picture.id)
        )

        return ProfilePictureResponse.model_validate(profile_picture_dict)

    except HTTPException:
        # Re-raise expected HTTP errors (e.g., non-square validation)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {e!s}"
        ) from e


@router.put("/{profile_picture_id}/activate", response_model=ProfilePictureResponse)
async def activate_profile_picture_endpoint(
    profile_picture_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Set a profile picture as active (admin only). This will deactivate all other profile pictures."""
    profile_picture = await activate_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Add secure URLs to response
    profile_picture_dict = ProfilePictureResponse.model_validate(
        profile_picture
    ).model_dump()
    profile_picture_dict = populate_profile_picture_urls(
        profile_picture_dict, str(profile_picture.id)
    )

    return ProfilePictureResponse.model_validate(profile_picture_dict)


@router.put("/{profile_picture_id}", response_model=ProfilePictureResponse)
async def update_profile_picture_endpoint(
    profile_picture_id: UUID,
    profile_picture_update: ProfilePictureUpdate,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Update profile picture metadata (admin only)."""
    profile_picture = await update_profile_picture(
        db, profile_picture_id, profile_picture_update
    )
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Add secure URLs to response
    profile_picture_dict = ProfilePictureResponse.model_validate(
        profile_picture
    ).model_dump()
    profile_picture_dict = populate_profile_picture_urls(
        profile_picture_dict, str(profile_picture.id)
    )

    return ProfilePictureResponse.model_validate(profile_picture_dict)


@router.delete("/{profile_picture_id}")
async def delete_profile_picture_endpoint(
    profile_picture_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Delete profile picture (admin only)."""
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Delete files
    profile_picture_data: dict = {
        "original_path": profile_picture.original_path,
        "variants": profile_picture.variants or {},
    }
    await image_processor.delete_image_files(profile_picture_data)

    # Delete database record
    success = await delete_profile_picture(db, profile_picture_id)
    if not success:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    return {"message": "Profile picture deleted successfully"}


@router.get("/{profile_picture_id}/file")
async def serve_profile_picture_original(
    profile_picture_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_session),
    current_user: Any | None = Depends(get_current_user_optional),
):
    """Serve original profile picture file."""
    # Get profile picture
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Profile pictures are always public, no access control needed
    file_path = file_access_controller.get_file_path(profile_picture, FileType.ORIGINAL)

    # Return file
    content_type = file_access_controller.get_content_type(file_path)
    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},  # Cache for 24 hours
    )


@router.get("/{profile_picture_id}/file/{variant}")
async def serve_profile_picture_variant(
    profile_picture_id: UUID,
    variant: str,
    request: Request,
    db: AsyncSession = Depends(get_session),
    current_user: Any | None = Depends(get_current_user_optional),
):
    """Serve profile picture variant."""
    # Validate variant
    try:
        file_type = FileType(variant)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid variant '{variant}'",
        ) from e

    # Get profile picture
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Profile pictures are always public, no access control needed
    file_path = file_access_controller.get_file_path(profile_picture, file_type)

    # Return file
    content_type = file_access_controller.get_content_type(file_path)
    cache_control = "public, max-age=86400"  # Cache all variants for 24 hours

    return FileResponse(
        path=str(file_path),
        media_type=content_type,
        headers={"Cache-Control": cache_control},
    )


@router.get("/{profile_picture_id}/download")
async def download_profile_picture_original(
    profile_picture_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin_user),
):
    """Download original profile picture file (admin only)."""
    # Get profile picture
    profile_picture = await get_profile_picture(db, profile_picture_id)
    if not profile_picture:
        raise HTTPException(status_code=404, detail="Profile picture not found")

    # Get file path
    file_path = file_access_controller.get_file_path(profile_picture, FileType.ORIGINAL)

    # Get download filename
    download_filename = file_access_controller.get_download_filename(
        profile_picture, FileType.ORIGINAL
    )

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
