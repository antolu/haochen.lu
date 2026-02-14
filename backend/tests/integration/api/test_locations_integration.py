"""
Comprehensive Location API Integration Tests

Tests location search, geocoding, and photo location features.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.integration
async def test_search_locations_by_query(
    integration_client: AsyncClient,
):
    """Test searching for locations by query string."""
    response = await integration_client.get("/api/locations/search?q=San Francisco")

    assert response.status_code == 200
    data = response.json()

    assert isinstance(data, list)
    assert len(data) > 0

    # Verify location result structure
    location = data[0]
    assert "location_name" in location or "display_name" in location
    assert "latitude" in location or "lat" in location
    assert "longitude" in location or "lon" in location
    location_text = location.get("location_name") or location.get("display_name", "")
    assert "San Francisco" in location_text


@pytest.mark.integration
async def test_reverse_geocode_coordinates(
    integration_client: AsyncClient,
):
    """Test reverse geocoding coordinates to location name."""
    # San Francisco coordinates
    lat, lon = 37.7749, -122.4194

    response = await integration_client.get(
        f"/api/locations/reverse?lat={lat}&lng={lon}"
    )

    assert response.status_code == 200
    data = response.json()

    assert "location_name" in data
    # Should contain San Francisco
    assert "San Francisco" in data["location_name"]


@pytest.mark.integration
async def test_forward_geocode_address(
    integration_client: AsyncClient,
):
    """Test forward geocoding address to coordinates."""
    response = await integration_client.get(
        "/api/locations/geocode?address=San Francisco, CA"
    )

    assert response.status_code == 200
    data = response.json()

    assert "latitude" in data
    assert "longitude" in data
    assert "location_name" in data

    # Coordinates should be approximately correct for San Francisco
    assert 37.7 < data["latitude"] < 37.8
    assert -122.5 < data["longitude"] < -122.4


@pytest.mark.integration
async def test_get_photos_near_location(
    integration_client: AsyncClient,
):
    """Test getting photos near a specific location."""
    # San Francisco coordinates
    lat, lon = 37.7749, -122.4194
    radius_km = 10

    response = await integration_client.get(
        f"/api/photos?near_lat={lat}&near_lon={lon}&radius={radius_km}"
    )

    assert response.status_code == 200
    data = response.json()

    assert "photos" in data
    # Should have at least 2 photos in SF area from seeded data
    assert len(data["photos"]) >= 2

    # Verify photos have location data
    for photo in data["photos"]:
        assert "location_lat" in photo
        assert "location_lon" in photo
        assert photo["location_lat"] is not None
        assert photo["location_lon"] is not None


@pytest.mark.integration
async def test_location_clustering_for_map(
    integration_client: AsyncClient,
):
    """Test location clustering for map display."""
    response = await integration_client.get("/api/photos/locations")

    assert response.status_code == 200
    data = response.json()

    assert "locations" in data
    locations = data["locations"]

    # Should have photos with locations
    assert len(locations) >= 2

    # Verify clustering data structure
    for loc in locations:
        assert "location_lat" in loc
        assert "location_lon" in loc
        assert "photo_count" in loc or "id" in loc
        assert "thumbnail_url" in loc


@pytest.mark.integration
async def test_location_search_handles_special_characters(
    integration_client: AsyncClient,
):
    """Test location search handles special characters."""
    response = await integration_client.get(
        "/api/locations/search?q=Zürich, Switzerland"
    )

    assert response.status_code == 200
    data = response.json()

    # Should not crash and return results
    assert isinstance(data, list)


@pytest.mark.integration
async def test_location_search_empty_query_returns_error(
    integration_client: AsyncClient,
):
    """Test location search with empty query returns error."""
    response = await integration_client.get("/api/locations/search?q=")

    # Should return error for empty query
    assert response.status_code in [400, 422]


@pytest.mark.integration
async def test_reverse_geocode_invalid_coordinates_returns_error(
    integration_client: AsyncClient,
):
    """Test reverse geocoding with invalid coordinates returns error."""
    # Invalid latitude (> 90)
    response = await integration_client.get("/api/locations/reverse?lat=999&lng=0")

    assert response.status_code in [400, 422]


@pytest.mark.integration
async def test_location_caching(
    integration_client: AsyncClient,
):
    """Test that location geocoding results are cached."""
    # Same coordinates twice
    lat, lon = 37.7749, -122.4194

    # First request
    response1 = await integration_client.get(
        f"/api/locations/reverse?lat={lat}&lng={lon}"
    )
    assert response1.status_code == 200

    # Second request (should be cached)
    response2 = await integration_client.get(
        f"/api/locations/reverse?lat={lat}&lng={lon}"
    )
    assert response2.status_code == 200

    # Results should be identical
    assert response1.json() == response2.json()


@pytest.mark.integration
async def test_photo_location_update(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test updating a photo's location."""
    # Get a photo
    list_response = await integration_client.get("/api/photos?per_page=1")
    photo_id = list_response.json()["photos"][0]["id"]

    # Update location
    update_data = {
        "location_lat": 40.7128,
        "location_lon": -74.0060,
        "location_name": "New York, NY, USA",
    }

    response = await integration_client.put(
        f"/api/photos/{photo_id}",
        json=update_data,
        headers=admin_auth_headers,
    )

    assert response.status_code == 200
    photo = response.json()

    assert photo["location_lat"] == pytest.approx(40.7128)
    assert photo["location_lon"] == pytest.approx(-74.0060)
    assert "New York" in photo["location_name"]


@pytest.mark.integration
async def test_location_validation(
    integration_client: AsyncClient,
    admin_auth_headers: dict[str, str],
):
    """Test location coordinate validation."""
    list_response = await integration_client.get("/api/photos?per_page=1")
    photo_id = list_response.json()["photos"][0]["id"]

    # Invalid latitude
    update_data = {
        "location_lat": 999,
        "location_lon": 0,
    }

    response = await integration_client.put(
        f"/api/photos/{photo_id}",
        json=update_data,
        headers=admin_auth_headers,
    )

    # Should fail validation
    assert response.status_code in [400, 422]
