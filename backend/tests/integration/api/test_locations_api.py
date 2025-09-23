from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def mock_location_service():
    """Mock location service for testing."""
    with patch("app.core.location_service.location_service") as mock_service:
        yield mock_service


class TestLocationAPI:
    """Test cases for location API endpoints."""

    def test_reverse_geocode_success(self, client, mock_location_service):
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

    def test_reverse_geocode_with_language(self, client, mock_location_service):
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

    def test_reverse_geocode_not_found(self, client, mock_location_service):
        """Test reverse geocoding when no location is found."""
        mock_location_service.reverse_geocode.return_value = None

        response = client.get("/api/locations/reverse?lat=0.0&lng=0.0")

        assert response.status_code == 404
        assert "No location found" in response.json()["detail"]

    def test_reverse_geocode_missing_parameters(self, client):
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

    def test_reverse_geocode_invalid_coordinates(self, client, mock_location_service):
        """Test reverse geocoding with invalid coordinate values."""
        mock_location_service.reverse_geocode.return_value = None

        # Invalid latitude (too large)
        response = client.get("/api/locations/reverse?lat=91.0&lng=-122.4194")
        assert response.status_code == 404

        # Invalid longitude (too small)
        response = client.get("/api/locations/reverse?lat=37.7749&lng=-181.0")
        assert response.status_code == 404

    def test_search_locations_success(self, client, mock_location_service):
        """Test successful location search."""
        mock_location_service.search_locations.return_value = [
            {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "location_name": "San Francisco, California, United States",
                "location_address": "San Francisco, CA, USA",
                "place_id": "123456",
                "osm_type": "way",
                "osm_id": "987654",
            },
            {
                "latitude": 37.7849,
                "longitude": -122.4094,
                "location_name": "San Francisco Bay Area, California, United States",
                "location_address": "Bay Area, CA, USA",
                "place_id": "789012",
                "osm_type": "relation",
                "osm_id": "345678",
            },
        ]

        response = client.get("/api/locations/search?q=San Francisco")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["latitude"] == 37.7749
        assert data[0]["longitude"] == -122.4194
        assert data[0]["location_name"] == "San Francisco, California, United States"

        mock_location_service.search_locations.assert_called_once_with(
            "San Francisco", 10, "en"
        )

    def test_search_locations_with_limit(self, client, mock_location_service):
        """Test location search with custom limit."""
        mock_location_service.search_locations.return_value = []

        response = client.get("/api/locations/search?q=test&limit=5")

        assert response.status_code == 200
        mock_location_service.search_locations.assert_called_once_with("test", 5, "en")

    def test_search_locations_limit_validation(self, client):
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

    def test_search_locations_missing_query(self, client):
        """Test location search with missing query parameter."""
        response = client.get("/api/locations/search")
        assert response.status_code == 422

    def test_search_locations_empty_results(self, client, mock_location_service):
        """Test location search with no results."""
        mock_location_service.search_locations.return_value = []

        response = client.get("/api/locations/search?q=NonExistentPlace123")

        assert response.status_code == 200
        data = response.json()
        assert data == []

    def test_forward_geocode_success(self, client, mock_location_service):
        """Test successful forward geocoding."""
        mock_location_service.forward_geocode.return_value = {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "location_name": "San Francisco, California, United States",
            "place_id": "123456",
            "osm_type": "way",
            "osm_id": "987654",
        }

        response = client.get("/api/locations/geocode?address=San Francisco, CA")

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 37.7749
        assert data["longitude"] == -122.4194
        assert data["location_name"] == "San Francisco, California, United States"
        assert (
            data["location_address"] == "San Francisco, California, United States"
        )  # Uses location_name as fallback

        mock_location_service.forward_geocode.assert_called_once_with(
            "San Francisco, CA", "en"
        )

    def test_forward_geocode_not_found(self, client, mock_location_service):
        """Test forward geocoding when address is not found."""
        mock_location_service.forward_geocode.return_value = None

        response = client.get("/api/locations/geocode?address=NonExistentLocation123")

        assert response.status_code == 404
        assert "No location found" in response.json()["detail"]

    def test_forward_geocode_missing_address(self, client):
        """Test forward geocoding with missing address parameter."""
        response = client.get("/api/locations/geocode")
        assert response.status_code == 422

    def test_get_nearby_locations_success(self, client, mock_location_service):
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
        assert data[0]["distance_km"] == 1.2
        assert data[0]["type"] == "attraction"

        mock_location_service.get_nearby_locations.assert_called_once_with(
            37.7749, -122.4194, 10.0, 20
        )

    def test_get_nearby_locations_with_custom_params(
        self, client, mock_location_service
    ):
        """Test nearby locations with custom radius and limit."""
        mock_location_service.get_nearby_locations.return_value = []

        response = client.get(
            "/api/locations/nearby?lat=37.7749&lng=-122.4194&radius=5.0&limit=10"
        )

        assert response.status_code == 200
        mock_location_service.get_nearby_locations.assert_called_once_with(
            37.7749, -122.4194, 5.0, 10
        )

    def test_get_nearby_locations_parameter_validation(self, client):
        """Test nearby locations parameter validation."""
        # Missing coordinates
        response = client.get("/api/locations/nearby")
        assert response.status_code == 422

        # Invalid radius (too small)
        response = client.get(
            "/api/locations/nearby?lat=37.7749&lng=-122.4194&radius=0.05"
        )
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
        response = client.get(
            "/api/locations/nearby?lat=37.7749&lng=-122.4194&limit=200"
        )
        assert response.status_code == 422

    def test_get_nearby_locations_empty_results(self, client, mock_location_service):
        """Test nearby locations with no results."""
        mock_location_service.get_nearby_locations.return_value = []

        response = client.get("/api/locations/nearby?lat=0.0&lng=0.0")

        assert response.status_code == 200
        data = response.json()
        assert data == []


class TestLocationAPIIntegration:
    """Integration tests with async client."""

    @pytest.mark.asyncio
    async def test_reverse_geocode_async_client(self, mock_location_service):
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
            response = await client.get(
                "/api/locations/reverse?lat=37.7749&lng=-122.4194"
            )

            assert response.status_code == 200
            data = response.json()
            assert data["location_name"] == "Test Location"

    @pytest.mark.asyncio
    async def test_location_search_async_client(self, mock_location_service):
        """Test location search with async client."""
        mock_location_service.search_locations.return_value = [
            {
                "latitude": 37.7749,
                "longitude": -122.4194,
                "location_name": "Test Location",
                "location_address": "Test Address",
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


class TestLocationAPIErrorHandling:
    """Test error handling scenarios."""

    def test_location_service_exception(self, client, mock_location_service):
        """Test API behavior when location service raises exceptions."""
        mock_location_service.reverse_geocode.side_effect = Exception("Service error")

        response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

        # Should handle gracefully - the exception should be caught by the service itself
        # and return None, which results in 404
        assert response.status_code == 500 or response.status_code == 404

    def test_invalid_json_response_handling(self, client, mock_location_service):
        """Test handling of malformed location service responses."""
        # Mock service returns invalid data structure
        mock_location_service.reverse_geocode.return_value = "invalid_response"

        response = client.get("/api/locations/reverse?lat=37.7749&lng=-122.4194")

        # Should handle gracefully
        assert response.status_code in [404, 500]

    def test_unicode_query_handling(self, client, mock_location_service):
        """Test handling of unicode characters in search queries."""
        mock_location_service.search_locations.return_value = []

        response = client.get("/api/locations/search?q=München, Deutschland 🇩🇪")

        assert response.status_code == 200
        # Should properly encode unicode in URL parameters
        mock_location_service.search_locations.assert_called_once()

    def test_very_long_query_handling(self, client, mock_location_service):
        """Test handling of very long search queries."""
        long_query = "A" * 1000  # Very long query
        mock_location_service.search_locations.return_value = []

        response = client.get(f"/api/locations/search?q={long_query}")

        # Should handle long queries gracefully
        assert response.status_code == 200

    def test_special_character_address_handling(self, client, mock_location_service):
        """Test handling of addresses with special characters."""
        mock_location_service.forward_geocode.return_value = None

        response = client.get("/api/locations/geocode?address=123 Main St. & Co., #456")

        assert response.status_code == 404  # Not found is fine for this test
        # Should properly handle special characters in address


class TestLocationAPIPerformance:
    """Performance-related tests."""

    def test_concurrent_requests_handling(self, client, mock_location_service):
        """Test that API can handle multiple concurrent requests."""
        import threading

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

    def test_response_time_reasonable(self, client, mock_location_service):
        """Test that API response times are reasonable."""
        import time

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
