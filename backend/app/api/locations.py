from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.core.location_service import location_service
from app.dependencies import _current_admin_user_dependency
from app.models.location import (
    ForwardGeocodeResult,
    LocationSearchResult,
    NearbyLocationResult,
    ReverseGeocodeResult,
)
from app.models.user import User

router = APIRouter()


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lng: float = Query(..., description="Longitude", ge=-180, le=180),
    language: str = Query(
        "en", description="Language code", min_length=2, max_length=5
    ),
) -> ReverseGeocodeResult:
    """Get location information from coordinates."""
    try:
        result = await location_service.reverse_geocode(lat, lng, language)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid coordinates: {e}") from e
    except Exception as e:
        raise HTTPException(
            status_code=503, detail="Location service temporarily unavailable"
        ) from e

    if not result:
        raise HTTPException(
            status_code=404, detail="No location found for the given coordinates"
        )

    return result


@router.get("/search")
async def search_locations(
    q: str = Query(..., description="Search query", min_length=2, max_length=200),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of results"),
    language: str = Query(
        "en", description="Language code", min_length=2, max_length=5
    ),
) -> list[LocationSearchResult]:
    """Search for locations matching the query."""
    # Sanitize search query
    q = q.strip()
    if not q:
        raise HTTPException(status_code=422, detail="Search query cannot be empty")

    try:
        results = await location_service.search_locations(q, limit, language)
    except Exception as e:
        raise HTTPException(
            status_code=503, detail="Location service temporarily unavailable"
        ) from e

    return results


@router.get("/geocode")
async def forward_geocode(
    address: str = Query(
        ..., description="Address to geocode", min_length=3, max_length=500
    ),
    language: str = Query(
        "en", description="Language code", min_length=2, max_length=5
    ),
) -> ForwardGeocodeResult:
    """Get coordinates from address."""
    # Sanitize address
    address = address.strip()
    if not address:
        raise HTTPException(status_code=422, detail="Address cannot be empty")

    try:
        result = await location_service.forward_geocode(address, language)
    except Exception as e:
        raise HTTPException(
            status_code=503, detail="Location service temporarily unavailable"
        ) from e

    if not result:
        raise HTTPException(
            status_code=404, detail="No location found for the given address"
        )

    return result


@router.get("/nearby")
async def get_nearby_locations(
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lng: float = Query(..., description="Longitude", ge=-180, le=180),
    radius: float = Query(
        10.0, ge=0.1, le=50.0, description="Search radius in kilometers"
    ),
    limit: int = Query(20, ge=1, le=100, description="Maximum number of results"),
) -> list[NearbyLocationResult]:
    """Get notable locations near given coordinates."""
    try:
        results = await location_service.get_nearby_locations(lat, lng, radius, limit)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Invalid coordinates: {e}") from e
    except Exception as e:
        raise HTTPException(
            status_code=503, detail="Location service temporarily unavailable"
        ) from e

    return results


@router.get("/cache/stats")
async def get_cache_stats(
    current_user: User = _current_admin_user_dependency,
) -> dict[str, int | bool]:
    """Get location cache statistics (admin only)."""
    return await location_service.get_cache_stats()


@router.delete("/cache")
async def clear_cache(
    operation: str | None = Query(
        None, description="Operation type to clear (reverse, forward, search)"
    ),
    current_user: User = _current_admin_user_dependency,
) -> dict[str, int | str]:
    """Clear location cache (admin only)."""
    deleted_count = await location_service.clear_cache(operation)
    return {"deleted_keys": deleted_count, "operation": operation or "all"}
