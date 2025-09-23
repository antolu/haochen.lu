from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.content import (
    create_content,
    delete_content,
    get_content_by_id,
    get_content_by_key,
    get_content_list,
    get_public_content_by_category,
    get_public_content_by_keys,
    update_content,
)
from app.database import get_session
from app.dependencies import get_current_admin_user
from app.schemas.content import (
    ContentCreate,
    ContentKeyValueResponse,
    ContentListResponse,
    ContentResponse,
    ContentUpdate,
)

router = APIRouter(prefix="/content", tags=["content"])

# Module-level dependency variables to avoid B008
db_dependency = Depends(get_session)
admin_dependency = Depends(get_current_admin_user)


@router.get("/public", response_model=dict[str, ContentKeyValueResponse])
async def get_public_content(
    db: AsyncSession = db_dependency,
    keys: str | None = Query(None, description="Comma-separated list of content keys"),
    category: str | None = Query(None, description="Filter by content category"),
):
    """
    Retrieve public (active) content items by keys or category.
    Returns a dictionary where keys are content keys and values are
    ContentKeyValue objects.
    """
    if keys:
        key_list = [k.strip() for k in keys.split(",")]
        content_items = await get_public_content_by_keys(db, key_list)
    elif category:
        content_items = await get_public_content_by_category(db, category)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'keys' or 'category' parameter must be provided.",
        )

    return {
        item.key: ContentKeyValueResponse.model_validate(item, from_attributes=True)
        for item in content_items
    }


@router.get("/key/{key}", response_model=ContentKeyValueResponse)
async def get_public_content_by_key_endpoint(
    key: str,
    db: AsyncSession = db_dependency,
):
    """
    Retrieve a single public (active) content item by its unique key.
    """
    content_item = await get_content_by_key(db, key)
    if not content_item or not content_item.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Content not found or not active",
        )
    return ContentKeyValueResponse.model_validate(content_item, from_attributes=True)


@router.get("", response_model=ContentListResponse)
async def list_content(
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    category: str | None = Query(None),
    *,
    is_active: bool | None = Query(default=None),
    search: str | None = Query(None),
    order_by: str = Query("created_at"),
    order_direction: str = Query("desc"),
):
    """
    Retrieve a list of content items (admin only).
    """
    return await get_content_list(
        db,
        page=page,
        per_page=per_page,
        category=category,
        is_active=is_active,
        search=search,
        order_by=order_by,
        order_direction=order_direction,
    )


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content_by_id_endpoint(
    content_id: str,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """
    Retrieve a single content item by ID (admin only).
    """
    content_item = await get_content_by_id(db, content_id)
    if not content_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content not found"
        )
    return content_item


@router.post("", response_model=ContentResponse, status_code=status.HTTP_201_CREATED)
async def create_content_endpoint(
    content_in: ContentCreate,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """
    Create a new content item (admin only).
    """
    existing_content = await get_content_by_key(db, content_in.key)
    if existing_content:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Content with key '{content_in.key}' already exists.",
        )
    return await create_content(db, content_in)


@router.put("/{content_id}", response_model=ContentResponse)
async def update_content_endpoint(
    content_id: str,
    content_in: ContentUpdate,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """
    Update an existing content item (admin only).
    """
    content_item = await update_content(db, content_id, content_in)
    if not content_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content not found"
        )
    return content_item


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_endpoint(
    content_id: str,
    db: AsyncSession = db_dependency,
    current_user=admin_dependency,
):
    """
    Delete a content item (admin only).
    """
    success = await delete_content(db, content_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Content not found"
        )
    return {"message": "Content deleted successfully"}
