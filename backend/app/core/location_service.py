from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import math
import time
from typing import Any

import httpx
from geopy.geocoders import Nominatim

from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class LocationService:
    """Service for geocoding and reverse geocoding using OpenStreetMap Nominatim."""

    def __init__(self):
        self.geolocator = Nominatim(user_agent="photography-portfolio/1.0", timeout=10)
        # Cache TTL in seconds (24 hours for geocoding, 1 hour for search)
        self.geocoding_cache_ttl = 24 * 60 * 60
        self.search_cache_ttl = 60 * 60
        # Rate limiting (1 request per second per operation)
        self.rate_limit_window = 1.0
        self._last_request_times = {}

    def _generate_cache_key(self, operation: str, *args) -> str:
        """Generate a cache key for the given operation and arguments."""
        key_data = f"{operation}:{':'.join(str(arg) for arg in args)}"
        return f"location:{hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()}"

    async def _get_cached_result(
        self, cache_key: str
    ) -> dict[str, Any] | list[dict[str, Any]] | None:
        """Get cached result from Redis."""
        try:
            if await redis_client.is_connected():
                cached_data = await redis_client.get(cache_key)
                if cached_data:
                    return json.loads(cached_data)
        except Exception as e:
            logger.warning(f"Error reading from cache: {e}")
        return None

    async def _cache_result(
        self, cache_key: str, result: dict[str, Any] | list[dict[str, Any]], ttl: int
    ) -> None:
        """Cache result in Redis."""
        try:
            if await redis_client.is_connected() and result is not None:
                await redis_client.setex(cache_key, ttl, json.dumps(result))
        except Exception as e:
            logger.warning(f"Error writing to cache: {e}")

    def _validate_coordinates(self, latitude: float, longitude: float) -> None:
        """Validate coordinate bounds."""
        if not (-90 <= latitude <= 90):
            msg = f"Latitude must be between -90 and 90, got {latitude}"
            raise ValueError(msg)
        if not (-180 <= longitude <= 180):
            msg = f"Longitude must be between -180 and 180, got {longitude}"
            raise ValueError(msg)

    def _validate_string_input(
        self, text: str, field_name: str, min_length: int = 1, max_length: int = 500
    ) -> str:
        """Validate and sanitize string input."""
        if not isinstance(text, str):
            msg = f"{field_name} must be a string"
            raise TypeError(msg)

        text = text.strip()
        if len(text) < min_length:
            msg = f"{field_name} must be at least {min_length} characters"
            raise ValueError(msg)
        if len(text) > max_length:
            msg = f"{field_name} must be at most {max_length} characters"
            raise ValueError(msg)

        return text

    async def _rate_limit_check(self, operation: str) -> None:
        """Check rate limits for operations."""
        current_time = time.time()
        last_time = self._last_request_times.get(operation, 0)

        if current_time - last_time < self.rate_limit_window:
            sleep_time = self.rate_limit_window - (current_time - last_time)
            await asyncio.sleep(sleep_time)

        self._last_request_times[operation] = time.time()

    async def reverse_geocode(
        self, latitude: float, longitude: float, language: str = "en"
    ) -> dict[str, Any] | None:
        """Get location information from coordinates."""
        # Validate inputs
        self._validate_coordinates(latitude, longitude)
        language = self._validate_string_input(language, "language", 2, 5)

        # Generate cache key
        cache_key = self._generate_cache_key("reverse", latitude, longitude, language)

        # Try to get from cache first
        cached_result = await self._get_cached_result(cache_key)
        if cached_result and isinstance(cached_result, dict):
            logger.debug(f"Cache hit for reverse geocoding {latitude}, {longitude}")
            return cached_result

        try:
            # Rate limiting
            await self._rate_limit_check("reverse")

            # Run the blocking geocoding operation in a thread
            location = await asyncio.to_thread(
                self.geolocator.reverse, f"{latitude}, {longitude}", language=language
            )

            if not location or not location.address:
                return None

            # Parse the raw address data
            address = location.raw.get("address", {})

            # Build location name prioritizing general area over specific address
            location_parts = []

            # Priority order: city > town > village > municipality
            for key in ["city", "town", "village", "municipality"]:
                if key in address:
                    location_parts.append(address[key])
                    break

            # Add state/province/region
            for key in ["state", "province", "region", "county"]:
                if key in address:
                    location_parts.append(address[key])
                    break

            # Add country
            if "country" in address:
                location_parts.append(address["country"])

            location_name = ", ".join(location_parts) if location_parts else None

            result = {
                "location_name": location_name,
                "location_address": location.address,
                "raw_address": address,
                "place_id": location.raw.get("place_id"),
                "osm_type": location.raw.get("osm_type"),
                "osm_id": location.raw.get("osm_id"),
            }

            # Cache the result
            await self._cache_result(cache_key, result, self.geocoding_cache_ttl)
            return result

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.exception(f"Error reverse geocoding {latitude}, {longitude}: {e}")
            return None

    async def forward_geocode(
        self, address: str, language: str = "en"
    ) -> dict[str, Any] | None:
        """Get coordinates from address."""
        # Validate inputs
        address = self._validate_string_input(address, "address", 3, 500)
        language = self._validate_string_input(language, "language", 2, 5)

        # Generate cache key
        cache_key = self._generate_cache_key("forward", address, language)

        # Try to get from cache first
        cached_result = await self._get_cached_result(cache_key)
        if cached_result and isinstance(cached_result, dict):
            logger.debug(f"Cache hit for forward geocoding '{address}'")
            return cached_result

        try:
            # Rate limiting
            await self._rate_limit_check("forward")

            location = await asyncio.to_thread(
                self.geolocator.geocode, address, language=language
            )

            if not location:
                return None

            result = {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "location_name": location.address,
                "location_address": location.address,
                "raw_address": location.raw.get("address", {}),
                "place_id": location.raw.get("place_id"),
                "osm_type": location.raw.get("osm_type"),
                "osm_id": location.raw.get("osm_id"),
            }

            # Cache the result
            await self._cache_result(cache_key, result, self.geocoding_cache_ttl)
            return result

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.exception(f"Error forward geocoding '{address}': {e}")
            return None

    async def search_locations(
        self, query: str, limit: int = 10, language: str = "en"
    ) -> list[dict[str, Any]]:
        """Search for locations matching query."""
        # Validate inputs
        query = self._validate_string_input(query, "query", 2, 200)
        language = self._validate_string_input(language, "language", 2, 5)

        if not (1 <= limit <= 50):
            msg = f"Limit must be between 1 and 50, got {limit}"
            raise ValueError(msg)

        # Generate cache key
        cache_key = self._generate_cache_key("search", query, limit, language)

        # Try to get from cache first
        cached_result = await self._get_cached_result(cache_key)
        if cached_result and isinstance(cached_result, list):
            logger.debug(f"Cache hit for location search '{query}'")
            return cached_result

        try:
            # Rate limiting
            await self._rate_limit_check("search")

            # Use Nominatim's search endpoint directly for multiple results
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "q": query,
                        "format": "json",
                        "addressdetails": 1,
                        "limit": limit,
                        "accept-language": language,
                    },
                    headers={"User-Agent": "photography-portfolio/1.0"},
                    timeout=10,
                )

                if response.status_code == 200:
                    results = response.json()

                    locations = []
                    for result in results:
                        address = result.get("address", {})

                        # Build display name
                        location_parts = []
                        for key in ["city", "town", "village", "municipality"]:
                            if key in address:
                                location_parts.append(address[key])
                                break

                        for key in ["state", "province", "region", "county"]:
                            if key in address:
                                location_parts.append(address[key])
                                break

                        if "country" in address:
                            location_parts.append(address["country"])

                        location_name = (
                            ", ".join(location_parts)
                            if location_parts
                            else result.get("display_name")
                        )

                        locations.append({
                            "latitude": float(result["lat"]),
                            "longitude": float(result["lon"]),
                            "location_name": location_name,
                            "location_address": result.get("display_name"),
                            "place_id": result.get("place_id"),
                            "osm_type": result.get("osm_type"),
                            "osm_id": result.get("osm_id"),
                            "raw_address": address,
                        })

                    # Cache the results
                    await self._cache_result(
                        cache_key, locations, self.search_cache_ttl
                    )
                    return locations

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.exception(f"Error searching locations for '{query}': {e}")

        return []

    async def get_nearby_locations(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 10.0,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Get notable locations near given coordinates."""
        # Validate inputs
        self._validate_coordinates(latitude, longitude)

        if not (0.1 <= radius_km <= 50.0):
            msg = f"Radius must be between 0.1 and 50.0 km, got {radius_km}"
            raise ValueError(msg)
        if not (1 <= limit <= 100):
            msg = f"Limit must be between 1 and 100, got {limit}"
            raise ValueError(msg)

        try:
            # Rate limiting
            await self._rate_limit_check("nearby")
            async with httpx.AsyncClient() as client:
                # Search for points of interest near coordinates
                response = await client.get(
                    "https://nominatim.openstreetmap.org/search",
                    params={
                        "lat": latitude,
                        "lon": longitude,
                        "radius": radius_km * 1000,  # Convert to meters
                        "format": "json",
                        "addressdetails": 1,
                        "limit": limit,
                        "extratags": 1,
                        "namedetails": 1,
                    },
                    headers={"User-Agent": "photography-portfolio/1.0"},
                    timeout=10,
                )

                if response.status_code == 200:
                    results = response.json()

                    locations = [
                        {
                            "latitude": float(result["lat"]),
                            "longitude": float(result["lon"]),
                            "name": result.get("display_name"),
                            "type": result.get("type"),
                            "class": result.get("class"),
                            "place_id": result.get("place_id"),
                            "distance_km": self._calculate_distance(
                                latitude,
                                longitude,
                                float(result["lat"]),
                                float(result["lon"]),
                            ),
                        }
                        for result in results
                    ]

                    # Sort by distance
                    locations.sort(key=lambda x: x["distance_km"])
                    return locations

        except ValueError:
            # Re-raise validation errors
            raise
        except Exception as e:
            logger.exception(
                f"Error getting nearby locations for {latitude}, {longitude}: {e}"
            )

        return []

    def _calculate_distance(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Calculate distance between two points in kilometers using Haversine formula."""

        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.asin(math.sqrt(a))

        # Earth radius in kilometers
        r = 6371

        return c * r

    async def clear_cache(self, operation: str | None = None) -> int:
        """Clear location cache. If operation is specified, only clear that operation's cache."""
        try:
            if not await redis_client.is_connected():
                return 0

            pattern = f"location:*{operation}*" if operation else "location:*"

            keys = await redis_client.keys(pattern)
            if keys:
                deleted = await redis_client.delete(*keys)
                logger.info(
                    f"Cleared {deleted} location cache entries for pattern '{pattern}'"
                )
                return deleted
            return 0

        except Exception as e:
            logger.exception(f"Error clearing location cache: {e}")
            return 0

    async def get_cache_stats(self) -> dict[str, int]:
        """Get location cache statistics."""
        try:
            if not await redis_client.is_connected():
                return {
                    "total_keys": 0,
                    "reverse_keys": 0,
                    "forward_keys": 0,
                    "search_keys": 0,
                }

            all_keys = await redis_client.keys("location:*")

            # Count different operation types (approximation based on hash)
            total = len(all_keys)

            return {
                "total_keys": total,
                "cache_enabled": True,
                "geocoding_ttl": self.geocoding_cache_ttl,
                "search_ttl": self.search_cache_ttl,
            }

        except Exception as e:
            logger.exception(f"Error getting cache stats: {e}")
            return {"total_keys": 0, "cache_enabled": False}


# Global instance
location_service = LocationService()
