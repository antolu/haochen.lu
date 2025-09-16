from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.main import app


class TestLocationAPIValidation:
    """Test location API validation and error handling."""

    @pytest.mark.asyncio
    async def test_reverse_geocode_invalid_latitude(self):
        """Test reverse geocoding with invalid latitude."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/reverse?lat=91&lng=0")
            assert response.status_code == 422
            data = response.json()
            assert "latitude" in data["detail"][0]["loc"]

    @pytest.mark.asyncio
    async def test_reverse_geocode_invalid_longitude(self):
        """Test reverse geocoding with invalid longitude."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/reverse?lat=0&lng=181")
            assert response.status_code == 422
            data = response.json()
            assert "longitude" in data["detail"][0]["loc"]

    @pytest.mark.asyncio
    async def test_reverse_geocode_invalid_language(self):
        """Test reverse geocoding with invalid language."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/reverse?lat=0&lng=0&language=x")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_locations_empty_query(self):
        """Test location search with empty query."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/search?q=")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_locations_long_query(self):
        """Test location search with too long query."""
        long_query = "a" * 201
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get(f"/api/locations/search?q={long_query}")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_locations_invalid_limit(self):
        """Test location search with invalid limit."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/search?q=test&limit=0")
            assert response.status_code == 422

            response = await client.get("/api/locations/search?q=test&limit=51")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forward_geocode_empty_address(self):
        """Test forward geocoding with empty address."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/geocode?address=")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_forward_geocode_short_address(self):
        """Test forward geocoding with too short address."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/geocode?address=ab")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_nearby_locations_invalid_coordinates(self):
        """Test nearby locations with invalid coordinates."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/nearby?lat=91&lng=0")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_nearby_locations_invalid_radius(self):
        """Test nearby locations with invalid radius."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/nearby?lat=0&lng=0&radius=0.05")
            assert response.status_code == 422

            response = await client.get("/api/locations/nearby?lat=0&lng=0&radius=51")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_nearby_locations_invalid_limit(self):
        """Test nearby locations with invalid limit."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/locations/nearby?lat=0&lng=0&limit=0")
            assert response.status_code == 422

            response = await client.get("/api/locations/nearby?lat=0&lng=0&limit=101")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_photos_api_invalid_proximity_params(self):
        """Test photos API with invalid proximity search parameters."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Missing longitude
            response = await client.get("/api/photos/?near_lat=37.7749")
            assert response.status_code == 422
            assert "near_lon" in response.text

            # Missing latitude
            response = await client.get("/api/photos/?near_lon=-122.4194")
            assert response.status_code == 422
            assert "near_lat" in response.text

    @pytest.mark.asyncio
    async def test_photos_api_invalid_coordinates(self):
        """Test photos API with invalid coordinates."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/photos/?near_lat=91&near_lon=0")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_photos_api_invalid_radius(self):
        """Test photos API with invalid radius."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/photos/?near_lat=37.7749&near_lon=-122.4194&radius=51")
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_photos_api_invalid_order_by(self):
        """Test photos API with invalid order_by parameter."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.get("/api/photos/?order_by=invalid")
            assert response.status_code == 422
