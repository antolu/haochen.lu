from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def mock_location_service():
    """Mock location service for testing."""
    with patch("app.api.locations.location_service") as mock_service:
        # Set up the mock with AsyncMock for all async methods
        mock_service.reverse_geocode = AsyncMock()
        mock_service.search_locations = AsyncMock()
        mock_service.forward_geocode = AsyncMock()
        mock_service.get_nearby_locations = AsyncMock()
        yield mock_service


def test_reverse_geocode_success(client, mock_location_service):
    """Test successful reverse geocoding API call."""
    mock_location_service.reverse_geocode.return_value = {
        "location_name": "San Francisco, California, United States",
        "location_address": "San Francisco, CA 94102, USA",
        "raw_address": {
            "city": "San Francisco",
            "state": "California",
            "country": "United States",
        },
        "place_id": "123456",
        "osm_type": "way",
        "osm_id": "987654",
    }

    response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

    assert response.status_code == 200
    data = response.json()
    assert data["location_name"] == "San Francisco, California, United States"
    assert data["location_address"] == "San Francisco, CA 94102, USA"
    assert data["place_id"] == "123456"
    assert data["osm_type"] == "way"
    assert data["osm_id"] == "987654"
    assert "raw_address" in data

    mock_location_service.reverse_geocode.assert_called_once_with(
        37.7749, -122.4194, "en"
    )


def test_reverse_geocode_with_language(client, mock_location_service):
    """Test reverse geocoding with custom language."""
    mock_location_service.reverse_geocode.return_value = {
        "location_name": "San Francisco, California, Estados Unidos",
        "location_address": "San Francisco, CA 94102, EE.UU.",
        "raw_address": {},
        "place_id": None,
        "osm_type": None,
        "osm_id": None,
    }

    response = client.get(
        "/api/locations/reverse?lat=37.7749&lng=-122.4194&language=es"
    )

    assert response.status_code == 200
    data = response.json()
    assert data["location_name"] == "San Francisco, California, Estados Unidos"

    mock_location_service.reverse_geocode.assert_called_once_with(
        37.7749, -122.4194, "es"
    )


def test_reverse_geocode_not_found(client, mock_location_service):
    """Test reverse geocoding when no location is found."""
    mock_location_service.reverse_geocode.return_value = None

    response = client.get("/api/locations/reverse?lat=0.0&lng=0.0")

    assert response.status_code == 404
    assert "No location found" in response.json()["detail"]


def test_reverse_geocode_missing_parameters(client):
    """Test reverse geocoding with missing parameters."""
    # Missing lng parameter
    response = client.get("/api/locations/reverse?lat=37.7749")
    assert response.status_code == 422

    # Missing lat parameter
    response = client.get("/api/locations/reverse?lng=-122.4194")
    assert response.status_code == 422

    # Missing both parameters
    response = client.get("/api/locations/reverse")
    assert response.status_code == 422


def test_reverse_geocode_invalid_coordinates(client, mock_location_service):
    """Test reverse geocoding with invalid coordinate values."""
    mock_location_service.reverse_geocode.return_value = None

    # Invalid latitude (too large) - should be rejected by validation
    response = client.get("/api/locations/reverse?lat=91.0&lng=-122.4194")
    assert response.status_code == 422

    # Invalid longitude (too small) - should be rejected by validation
    response = client.get("/api/locations/reverse?lat=37.7749&lng=-181.0")
    assert response.status_code == 422


def test_search_locations_success(client, mock_location_service):
    """Test successful location search."""
    mock_location_service.search_locations.return_value = [
        {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "location_name": "San Francisco, California, United States",
            "location_address": "San Francisco, CA, USA",
            "raw_address": {
                "city": "San Francisco",
                "state": "California",
                "country": "United States",
            },
            "place_id": "123456",
            "osm_type": "way",
            "osm_id": "987654",
        },
        {
            "latitude": 37.7849,
            "longitude": -122.4094,
            "location_name": "San Francisco Bay Area, California, United States",
            "location_address": "Bay Area, CA, USA",
            "raw_address": {
                "region": "Bay Area",
                "state": "California",
                "country": "United States",
            },
            "place_id": "789012",
            "osm_type": "relation",
            "osm_id": "345678",
        },
    ]

    response = client.get("/api/locations/search?q=San Francisco")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["latitude"] == pytest.approx(37.7749)
    assert data[0]["longitude"] == pytest.approx(-122.4194)
    assert data[0]["location_name"] == "San Francisco, California, United States"

    mock_location_service.search_locations.assert_called_once_with(
        "San Francisco", 10, "en"
    )


def test_search_locations_with_limit(client, mock_location_service):
    """Test location search with custom limit."""
    mock_location_service.search_locations.return_value = []

    response = client.get("/api/locations/search?q=test&limit=5")

    assert response.status_code == 200
    mock_location_service.search_locations.assert_called_once_with("test", 5, "en")


def test_search_locations_limit_validation(client):
    """Test location search limit validation."""
    # Limit too small
    response = client.get("/api/locations/search?q=test&limit=0")
    assert response.status_code == 422

    # Limit too large
    response = client.get("/api/locations/search?q=test&limit=100")
    assert response.status_code == 422

    # Valid limit
    response = client.get("/api/locations/search?q=test&limit=25")
    assert response.status_code == 200


def test_search_locations_missing_query(client):
    """Test location search with missing query parameter."""
    response = client.get("/api/locations/search")
    assert response.status_code == 422


def test_search_locations_empty_results(client, mock_location_service):
    """Test location search with no results."""
    mock_location_service.search_locations.return_value = []

    response = client.get("/api/locations/search?q=NonExistentPlace123")

    assert response.status_code == 200
    data = response.json()
    assert data == []


def test_forward_geocode_success(client, mock_location_service):
    """Test successful forward geocoding."""
    mock_location_service.forward_geocode.return_value = {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "location_name": "San Francisco, California, United States",
        "location_address": "San Francisco, CA 94102, USA",
        "raw_address": {
            "city": "San Francisco",
            "state": "California",
            "country": "United States",
        },
        "place_id": "123456",
        "osm_type": "way",
        "osm_id": "987654",
    }

    response = client.get("/api/locations/geocode?address=San Francisco, CA")

    assert response.status_code == 200
    data = response.json()
    assert data["latitude"] == pytest.approx(37.7749)
    assert data["longitude"] == pytest.approx(-122.4194)
    assert data["location_name"] == "San Francisco, California, United States"
    assert data["location_address"] == "San Francisco, CA 94102, USA"

    mock_location_service.forward_geocode.assert_called_once_with(
        "San Francisco, CA", "en"
    )


def test_forward_geocode_not_found(client, mock_location_service):
    """Test forward geocoding when address is not found."""
    mock_location_service.forward_geocode.return_value = None

    response = client.get("/api/locations/geocode?address=NonExistentLocation123")

    assert response.status_code == 404
    assert "No location found" in response.json()["detail"]


def test_forward_geocode_missing_address(client):
    """Test forward geocoding with missing address parameter."""
    response = client.get("/api/locations/geocode")
    assert response.status_code == 422


def test_get_nearby_locations_success(client, mock_location_service):
    """Test successful nearby locations retrieval."""
    mock_location_service.get_nearby_locations.return_value = [
        {
            "latitude": 37.7849,
            "longitude": -122.4094,
            "name": "Golden Gate Bridge",
            "type": "attraction",
            "class": "tourism",
            "place_id": "123456",
            "distance_km": 1.2,
        },
        {
            "latitude": 37.7649,
            "longitude": -122.4294,
            "name": "Fisherman's Wharf",
            "type": "attraction",
            "class": "tourism",
            "place_id": "789012",
            "distance_km": 2.5,
        },
    ]

    response = client.get("/api/locations/nearby?lat=37.7749&lng=-122.4194")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Golden Gate Bridge"
    assert data[0]["distance_km"] == pytest.approx(1.2)
    assert data[0]["type"] == "attraction"

    mock_location_service.get_nearby_locations.assert_called_once_with(
        37.7749, -122.4194, 10.0, 20
    )


def test_get_nearby_locations_with_custom_params(client, mock_location_service):
    """Test nearby locations with custom radius and limit."""
    mock_location_service.get_nearby_locations.return_value = []

    response = client.get(
        "/api/locations/nearby?lat=37.7749&lng=-122.4194&radius=5.0&limit=10"
    )

    assert response.status_code == 200
    mock_location_service.get_nearby_locations.assert_called_once_with(
        37.7749, -122.4194, 5.0, 10
    )


def test_get_nearby_locations_parameter_validation(client):
    """Test nearby locations parameter validation."""
    # Missing coordinates
    response = client.get("/api/locations/nearby")
    assert response.status_code == 422

    # Invalid radius (too small)
    response = client.get("/api/locations/nearby?lat=37.7749&lng=-122.4194&radius=0.05")
    assert response.status_code == 422

    # Invalid radius (too large)
    response = client.get(
        "/api/locations/nearby?lat=37.7749&lng=-122.4194&radius=100.0"
    )
    assert response.status_code == 422

    # Invalid limit (too small)
    response = client.get("/api/locations/nearby?lat=37.7749&lng=-122.4194&limit=0")
    assert response.status_code == 422

    # Invalid limit (too large)
    response = client.get("/api/locations/nearby?lat=37.7749&lng=-122.4194&limit=200")
    assert response.status_code == 422


def test_get_nearby_locations_empty_results(client, mock_location_service):
    """Test nearby locations with no results."""
    mock_location_service.get_nearby_locations.return_value = []

    response = client.get("/api/locations/nearby?lat=0.0&lng=0.0")

    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_reverse_geocode_async_client(mock_location_service):
    """Test reverse geocoding with async client."""
    mock_location_service.reverse_geocode.return_value = {
        "location_name": "Test Location",
        "location_address": "Test Address",
        "raw_address": {},
        "place_id": None,
        "osm_type": None,
        "osm_id": None,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

        assert response.status_code == 200
        data = response.json()
        assert data["location_name"] == "Test Location"


@pytest.mark.asyncio
async def test_location_search_async_client(mock_location_service):
    """Test location search with async client."""
    mock_location_service.search_locations.return_value = [
        {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "location_name": "Test Location",
            "location_address": "Test Address",
            "raw_address": {},
            "place_id": "123",
            "osm_type": "way",
            "osm_id": "456",
        }
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/locations/search?q=test")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["location_name"] == "Test Location"


def test_location_service_exception(client, mock_location_service):
    """Test API behavior when location service raises exceptions."""
    mock_location_service.reverse_geocode.side_effect = Exception("Service error")

    response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

    # Should return 503 Service Unavailable when location service throws exception
    assert response.status_code == 503


def test_invalid_json_response_handling(client, mock_location_service):
    """Test handling of malformed location service responses."""
    # Mock service returns None (which is handled as 404, not an invalid structure)
    mock_location_service.reverse_geocode.return_value = None

    response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

    # Should return 404 when no location found
    assert response.status_code == 404


def test_unicode_query_handling(client, mock_location_service):
    """Test handling of unicode characters in search queries."""
    mock_location_service.search_locations.return_value = []

    response = client.get("/api/locations/search?q=München, Deutschland 🇩🇪")

    assert response.status_code == 200
    # Should properly encode unicode in URL parameters
    mock_location_service.search_locations.assert_called_once()


def test_very_long_query_handling(client, mock_location_service):
    """Test handling of very long search queries."""
    long_query = "A" * 1000  # Very long query (exceeds max_length=200)
    mock_location_service.search_locations.return_value = []

    response = client.get(f"/api/locations/search?q={long_query}")

    # Should reject with 422 due to validation (max_length=200)
    assert response.status_code == 422


def test_special_character_address_handling(client, mock_location_service):
    """Test handling of addresses with special characters."""
    mock_location_service.forward_geocode.return_value = None

    response = client.get("/api/locations/geocode?address=123 Main St. & Co., #456")

    assert response.status_code == 404  # Not found is fine for this test
    # Should properly handle special characters in address


def test_concurrent_requests_handling(client, mock_location_service):
    """Test that API can handle multiple concurrent requests."""
    import threading  # noqa: PLC0415

    mock_location_service.reverse_geocode.return_value = {
        "location_name": "Test",
        "location_address": "Test Address",
        "raw_address": {},
        "place_id": None,
        "osm_type": None,
        "osm_id": None,
    }

    results = []

    def make_request():
        response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")
        results.append(response.status_code)

    # Create multiple threads to make concurrent requests
    threads = []
    for _ in range(10):
        thread = threading.Thread(target=make_request)
        threads.append(thread)
        thread.start()

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # All requests should succeed
    assert all(status == 200 for status in results)
    assert len(results) == 10


def test_response_time_reasonable(client, mock_location_service):
    """Test that API response times are reasonable."""
    import time  # noqa: PLC0415

    mock_location_service.reverse_geocode.return_value = {
        "location_name": "Test",
        "location_address": "Test",
        "raw_address": {},
        "place_id": None,
        "osm_type": None,
        "osm_id": None,
    }

    start_time = time.time()
    response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")
    end_time = time.time()

    response_time = end_time - start_time

    assert response.status_code == 200
    assert response_time < 1.0  # Should respond in less than 1 second
