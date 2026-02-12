from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.core.location_service import LocationService, location_service


@pytest.fixture
def location_service_instance():
    """Create a fresh LocationService instance for testing."""
    return LocationService()


@pytest.fixture
def mock_geopy_location():
    """Mock geopy location response."""
    location = MagicMock()
    location.address = "San Francisco, California, United States"
    location.latitude = 37.7749
    location.longitude = -122.4194
    location.raw = {
        "place_id": "123456",
        "osm_type": "way",
        "osm_id": "987654",
        "address": {
            "city": "San Francisco",
            "state": "California",
            "country": "United States",
        },
    }
    return location


@pytest.mark.asyncio
async def test_reverse_geocode_success(location_service_instance, mock_geopy_location):
    """Test successful reverse geocoding."""
    with (
        patch.object(location_service_instance.geolocator, "reverse"),
        # Mock asyncio.to_thread to return our mock location
        patch("asyncio.to_thread", return_value=mock_geopy_location),
    ):
        result = await location_service_instance.reverse_geocode(37.7749, -122.4194)

        assert result is not None
        assert result["location_name"] == "San Francisco, California, United States"
        assert result["location_address"] == "San Francisco, California, United States"
        assert result["place_id"] == "123456"
        assert result["osm_type"] == "way"
        assert result["osm_id"] == "987654"
        assert "raw_address" in result


@pytest.mark.asyncio
async def test_reverse_geocode_with_detailed_address(location_service_instance):
    """Test reverse geocoding with detailed address components."""
    mock_location = MagicMock()
    mock_location.address = "123 Main St, San Francisco, CA, USA"
    mock_location.raw = {
        "address": {
            "house_number": "123",
            "road": "Main Street",
            "city": "San Francisco",
            "state": "California",
            "country": "United States",
        }
    }

    with patch("asyncio.to_thread", return_value=mock_location):
        result = await location_service_instance.reverse_geocode(37.7749, -122.4194)

        # Should prioritize city, state, country over detailed address
        assert result["location_name"] == "San Francisco, California, United States"


@pytest.mark.asyncio
async def test_reverse_geocode_town_fallback(location_service_instance):
    """Test reverse geocoding fallback to town when no city."""
    mock_location = MagicMock()
    mock_location.address = "Small Town, County, State, Country"
    mock_location.raw = {
        "address": {
            "town": "Small Town",
            "county": "Some County",
            "state": "Some State",
            "country": "Some Country",
        }
    }

    with patch("asyncio.to_thread", return_value=mock_location):
        result = await location_service_instance.reverse_geocode(40.0, -100.0)

        # Should use town as fallback
        assert result["location_name"] == "Small Town, Some State, Some Country"


@pytest.mark.asyncio
async def test_reverse_geocode_no_location(location_service_instance):
    """Test reverse geocoding with no results."""
    with patch("asyncio.to_thread", return_value=None):
        result = await location_service_instance.reverse_geocode(0.0, 0.0)
        assert result is None


@pytest.mark.asyncio
async def test_reverse_geocode_exception_handling(location_service_instance):
    """Test reverse geocoding exception handling."""
    with patch("asyncio.to_thread", side_effect=Exception("Network error")):
        result = await location_service_instance.reverse_geocode(37.7749, -122.4194)
        assert result is None


@pytest.mark.asyncio
async def test_forward_geocode_success(location_service_instance, mock_geopy_location):
    """Test successful forward geocoding."""
    with patch("asyncio.to_thread", return_value=mock_geopy_location):
        result = await location_service_instance.forward_geocode("San Francisco, CA")

        assert result is not None
        assert result["latitude"] == 37.7749
        assert result["longitude"] == -122.4194
        assert result["location_name"] == "San Francisco, California, United States"
        assert result["place_id"] == "123456"


@pytest.mark.asyncio
async def test_forward_geocode_no_results(location_service_instance):
    """Test forward geocoding with no results."""
    with patch("asyncio.to_thread", return_value=None):
        result = await location_service_instance.forward_geocode("NonExistentPlace123")
        assert result is None


@pytest.mark.asyncio
async def test_search_locations_success(location_service_instance):
    """Test successful location search."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "lat": "37.7749",
            "lon": "-122.4194",
            "display_name": "San Francisco, California, United States",
            "place_id": "123456",
            "osm_type": "way",
            "osm_id": "987654",
            "address": {
                "city": "San Francisco",
                "state": "California",
                "country": "United States",
            },
        }
    ]

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response

        result = await location_service_instance.search_locations("San Francisco")

        assert len(result) == 1
        assert result[0]["latitude"] == 37.7749
        assert result[0]["longitude"] == -122.4194
        assert result[0]["location_name"] == "San Francisco, California, United States"


@pytest.mark.asyncio
async def test_search_locations_empty_query(location_service_instance):
    """Test location search with empty query."""
    result = await location_service_instance.search_locations("")
    assert result == []


@pytest.mark.asyncio
async def test_search_locations_http_error(location_service_instance):
    """Test location search with HTTP error."""
    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response

        result = await location_service_instance.search_locations("test")
        assert result == []


@pytest.mark.asyncio
async def test_get_nearby_locations_success(location_service_instance):
    """Test successful nearby locations search."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {
            "lat": "37.7849",
            "lon": "-122.4094",
            "display_name": "Nearby Point of Interest",
            "type": "attraction",
            "class": "tourism",
            "place_id": "789012",
        }
    ]

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response

        result = await location_service_instance.get_nearby_locations(
            37.7749, -122.4194
        )

        assert len(result) == 1
        assert result[0]["latitude"] == 37.7849
        assert result[0]["longitude"] == -122.4094
        assert result[0]["type"] == "attraction"
        assert "distance_km" in result[0]


@pytest.mark.asyncio
async def test_get_nearby_locations_sorted_by_distance(location_service_instance):
    """Test nearby locations are sorted by distance."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"lat": "37.8000", "lon": "-122.4000", "display_name": "Far Location"},
        {"lat": "37.7750", "lon": "-122.4190", "display_name": "Near Location"},
    ]

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response

        result = await location_service_instance.get_nearby_locations(
            37.7749, -122.4194
        )

        assert len(result) == 2
        # Nearer location should be first
        assert result[0]["distance_km"] < result[1]["distance_km"]


def test_calculate_distance(location_service_instance):
    """Test distance calculation using Haversine formula."""
    # Test known distance: SF to LA approximately 560 km
    sf_lat, sf_lon = 37.7749, -122.4194
    la_lat, la_lon = 34.0522, -118.2437

    distance = location_service_instance._calculate_distance(
        sf_lat, sf_lon, la_lat, la_lon
    )

    # Should be approximately 560 km (allow some variance)
    assert 550 <= distance <= 570


def test_calculate_distance_same_point(location_service_instance):
    """Test distance calculation for same point."""
    distance = location_service_instance._calculate_distance(
        37.7749, -122.4194, 37.7749, -122.4194
    )
    assert distance == 0.0


def test_global_instance_exists():
    """Test that global location_service instance exists."""
    assert location_service is not None
    assert isinstance(location_service, LocationService)


@pytest.mark.asyncio
async def test_reverse_geocode_invalid_coordinates(location_service_instance):
    """Test reverse geocoding with invalid coordinates."""
    # Test coordinates outside valid range
    result = await location_service_instance.reverse_geocode(91.0, 181.0)
    # Should handle gracefully (may return None or error from service)
    assert result is None or isinstance(result, dict)


@pytest.mark.asyncio
async def test_forward_geocode_special_characters(location_service_instance):
    """Test forward geocoding with special characters."""
    with patch("asyncio.to_thread", return_value=None):
        result = await location_service_instance.forward_geocode(
            "Location with émojis 🌍"
        )
        assert result is None


@pytest.mark.asyncio
async def test_search_locations_with_limit(location_service_instance):
    """Test location search respects limit parameter."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = [
        {"lat": "37.0", "lon": "-122.0", "display_name": "Test"}
    ] * 10

    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response

        await location_service_instance.search_locations("test", limit=5)

        # Should have called with correct limit
        mock_client.get.assert_called_once()
        call_args = mock_client.get.call_args
        assert call_args[1]["params"]["limit"] == 5


@pytest.mark.asyncio
async def test_language_parameter_handling(location_service_instance):
    """Test that language parameters are correctly passed."""
    with patch("asyncio.to_thread", return_value=None) as mock_to_thread:
        await location_service_instance.reverse_geocode(
            37.7749, -122.4194, language="es"
        )

        # Verify language parameter was passed
        call_args = mock_to_thread.call_args
        assert "es" in str(call_args)


@pytest.mark.asyncio
async def test_timeout_handling(location_service_instance):
    """Test timeout handling in HTTP requests."""
    with patch("httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client_class.return_value.__aenter__.return_value = mock_client
        mock_client.get.side_effect = httpx.TimeoutException("Timeout")

        result = await location_service_instance.search_locations("test")
        assert result == []
