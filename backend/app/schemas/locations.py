from __future__ import annotations

import typing

from pydantic import BaseModel


class LocationSearchResult(BaseModel):
    """Location search result."""

    latitude: float
    longitude: float
    location_name: str
    location_address: str
    place_id: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class ReverseGeocodeResult(BaseModel):
    """Reverse geocoding result."""

    location_name: str | None
    location_address: str | None
    raw_address: dict[str, typing.Any]
    place_id: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class NearbyLocation(BaseModel):
    """Nearby location result."""

    latitude: float
    longitude: float
    name: str
    type: str | None = None
    class_: str | None = None
    place_id: str | None = None
    distance_km: float
