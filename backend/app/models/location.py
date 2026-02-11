from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ReverseGeocodeResult(BaseModel):
    """Result from reverse geocoding operation."""

    model_config = ConfigDict(from_attributes=True)

    location_name: str | None = None
    location_address: str
    raw_address: dict[str, str]
    place_id: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class ForwardGeocodeResult(BaseModel):
    """Result from forward geocoding operation."""

    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float
    location_name: str
    location_address: str
    raw_address: dict[str, str]
    place_id: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class LocationSearchResult(BaseModel):
    """Result from location search operation."""

    model_config = ConfigDict(from_attributes=True)

    latitude: float
    longitude: float
    location_name: str
    location_address: str
    raw_address: dict[str, str]
    place_id: str | None = None
    osm_type: str | None = None
    osm_id: str | None = None


class NearbyLocationResult(BaseModel):
    """Result from nearby location search."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    latitude: float
    longitude: float
    name: str
    type: str | None = None
    class_: str | None = Field(None, alias="class")
    place_id: str | None = None
    distance_km: float
