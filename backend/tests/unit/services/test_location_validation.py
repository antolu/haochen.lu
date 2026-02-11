from __future__ import annotations

import pytest

from app.core.location_service import LocationService


@pytest.fixture
def location_service():
    """Create LocationService instance."""
    return LocationService()


def test_validate_coordinates_valid(location_service):
    """Test valid coordinate validation."""
    # Valid coordinates should not raise
    location_service._validate_coordinates(0, 0)
    location_service._validate_coordinates(37.7749, -122.4194)
    location_service._validate_coordinates(-90, -180)
    location_service._validate_coordinates(90, 180)


def test_validate_coordinates_invalid_latitude(location_service):
    """Test invalid latitude validation."""
    with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
        location_service._validate_coordinates(91, 0)

    with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
        location_service._validate_coordinates(-91, 0)


def test_validate_coordinates_invalid_longitude(location_service):
    """Test invalid longitude validation."""
    with pytest.raises(ValueError, match="Longitude must be between -180 and 180"):
        location_service._validate_coordinates(0, 181)

    with pytest.raises(ValueError, match="Longitude must be between -180 and 180"):
        location_service._validate_coordinates(0, -181)


def test_validate_string_input_valid(location_service):
    """Test valid string input validation."""
    result = location_service._validate_string_input("San Francisco", "city")
    assert result == "San Francisco"

    # Should strip whitespace
    result = location_service._validate_string_input("  San Francisco  ", "city")
    assert result == "San Francisco"


def test_validate_string_input_too_short(location_service):
    """Test string input too short."""
    with pytest.raises(ValueError, match="city must be at least 1 characters"):
        location_service._validate_string_input("", "city")

    with pytest.raises(ValueError, match="query must be at least 2 characters"):
        location_service._validate_string_input("a", "query", min_length=2)


def test_validate_string_input_too_long(location_service):
    """Test string input too long."""
    long_string = "a" * 501
    with pytest.raises(ValueError, match="address must be at most 500 characters"):
        location_service._validate_string_input(long_string, "address")


def test_validate_string_input_non_string(location_service):
    """Test non-string input validation."""
    with pytest.raises(ValueError, match="city must be a string"):
        location_service._validate_string_input(123, "city")


@pytest.mark.asyncio
async def test_reverse_geocode_invalid_coordinates(location_service):
    """Test reverse geocoding with invalid coordinates."""
    with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
        await location_service.reverse_geocode(91, 0)


@pytest.mark.asyncio
async def test_forward_geocode_invalid_address(location_service):
    """Test forward geocoding with invalid address."""
    with pytest.raises(ValueError, match="address must be at least 3 characters"):
        await location_service.forward_geocode("")


@pytest.mark.asyncio
async def test_search_locations_invalid_query(location_service):
    """Test location search with invalid query."""
    with pytest.raises(ValueError, match="query must be at least 2 characters"):
        await location_service.search_locations("")


@pytest.mark.asyncio
async def test_search_locations_invalid_limit(location_service):
    """Test location search with invalid limit."""
    with pytest.raises(ValueError, match="Limit must be between 1 and 50"):
        await location_service.search_locations("San Francisco", limit=0)

    with pytest.raises(ValueError, match="Limit must be between 1 and 50"):
        await location_service.search_locations("San Francisco", limit=51)


@pytest.mark.asyncio
async def test_nearby_locations_invalid_coordinates(location_service):
    """Test nearby locations with invalid coordinates."""
    with pytest.raises(ValueError, match="Latitude must be between -90 and 90"):
        await location_service.get_nearby_locations(91, 0)


@pytest.mark.asyncio
async def test_nearby_locations_invalid_radius(location_service):
    """Test nearby locations with invalid radius."""
    with pytest.raises(ValueError, match=r"Radius must be between 0\.1 and 50\.0 km"):
        await location_service.get_nearby_locations(37.7749, -122.4194, radius_km=0.05)

    with pytest.raises(ValueError, match=r"Radius must be between 0\.1 and 50\.0 km"):
        await location_service.get_nearby_locations(37.7749, -122.4194, radius_km=51)


@pytest.mark.asyncio
async def test_nearby_locations_invalid_limit(location_service):
    """Test nearby locations with invalid limit."""
    with pytest.raises(ValueError, match="Limit must be between 1 and 100"):
        await location_service.get_nearby_locations(37.7749, -122.4194, limit=0)

    with pytest.raises(ValueError, match="Limit must be between 1 and 100"):
        await location_service.get_nearby_locations(37.7749, -122.4194, limit=101)
