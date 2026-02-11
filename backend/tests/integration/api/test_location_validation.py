from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_reverse_geocode_invalid_latitude(async_client: AsyncClient):
    """Test reverse geocoding with invalid latitude."""
    response = await async_client.get("/api/locations/reverse?lat=91&lng=0")
    assert response.status_code == 422
    data = response.json()
    assert "latitude" in data["detail"][0]["loc"]


@pytest.mark.asyncio
async def test_reverse_geocode_invalid_longitude(async_client: AsyncClient):
    """Test reverse geocoding with invalid longitude."""
    response = await async_client.get("/api/locations/reverse?lat=0&lng=181")
    assert response.status_code == 422
    data = response.json()
    assert "longitude" in data["detail"][0]["loc"]


@pytest.mark.asyncio
async def test_reverse_geocode_invalid_language(async_client: AsyncClient):
    """Test reverse geocoding with invalid language."""
    response = await async_client.get("/api/locations/reverse?lat=0&lng=0&language=x")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_locations_empty_query(async_client: AsyncClient):
    """Test location search with empty query."""
    response = await async_client.get("/api/locations/search?q=")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_locations_long_query(async_client: AsyncClient):
    """Test location search with too long query."""
    long_query = "a" * 201
    response = await async_client.get(f"/api/locations/search?q={long_query}")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_search_locations_invalid_limit(async_client: AsyncClient):
    """Test location search with invalid limit."""
    response = await async_client.get("/api/locations/search?q=test&limit=0")
    assert response.status_code == 422

    response = await async_client.get("/api/locations/search?q=test&limit=51")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_forward_geocode_empty_address(async_client: AsyncClient):
    """Test forward geocoding with empty address."""
    response = await async_client.get("/api/locations/geocode?address=")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_forward_geocode_short_address(async_client: AsyncClient):
    """Test forward geocoding with too short address."""
    response = await async_client.get("/api/locations/geocode?address=ab")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nearby_locations_invalid_coordinates(async_client: AsyncClient):
    """Test nearby locations with invalid coordinates."""
    response = await async_client.get("/api/locations/nearby?lat=91&lng=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nearby_locations_invalid_radius(async_client: AsyncClient):
    """Test nearby locations with invalid radius."""
    response = await async_client.get("/api/locations/nearby?lat=0&lng=0&radius=0.05")
    assert response.status_code == 422

    response = await async_client.get("/api/locations/nearby?lat=0&lng=0&radius=51")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_nearby_locations_invalid_limit(async_client: AsyncClient):
    """Test nearby locations with invalid limit."""
    response = await async_client.get("/api/locations/nearby?lat=0&lng=0&limit=0")
    assert response.status_code == 422

    response = await async_client.get("/api/locations/nearby?lat=0&lng=0&limit=101")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_photos_api_invalid_proximity_params(async_client: AsyncClient):
    """Test photos API with invalid proximity search parameters."""
    # Missing longitude
    response = await async_client.get("/api/photos/?near_lat=37.7749")
    assert response.status_code == 422
    assert "near_lon" in response.text

    # Missing latitude
    response = await async_client.get("/api/photos/?near_lon=-122.4194")
    assert response.status_code == 422
    assert "near_lat" in response.text


@pytest.mark.asyncio
async def test_photos_api_invalid_coordinates(async_client: AsyncClient):
    """Test photos API with invalid coordinates."""
    response = await async_client.get("/api/photos/?near_lat=91&near_lon=0")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_photos_api_invalid_radius(async_client: AsyncClient):
    """Test photos API with invalid radius."""
    response = await async_client.get(
        "/api/photos/?near_lat=37.7749&near_lon=-122.4194&radius=51"
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_photos_api_invalid_order_by(async_client: AsyncClient):
    """Test photos API with invalid order_by parameter."""
    response = await async_client.get("/api/photos/?order_by=invalid")
    assert response.status_code == 422
