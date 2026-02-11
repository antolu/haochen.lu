from __future__ import annotations

from typing import TypedDict


class VariantInfo(TypedDict, total=False):
    """Image variant metadata structure."""

    path: str
    filename: str
    width: int
    height: int
    size_bytes: int
    format: str


class FormatVariants(TypedDict, total=False):
    """Format-specific variants (avif, webp, jpeg)."""

    avif: VariantInfo
    webp: VariantInfo
    jpeg: VariantInfo


# Union type for variants dict that supports both old and new formats
ImageVariants = dict[str, VariantInfo | FormatVariants]


# Nominatim address components - using dict since keys are dynamic
NominatimAddress = dict[str, str]


class ReverseGeocodeDict(TypedDict, total=False):
    """Result from reverse geocoding operation."""

    location_name: str | None
    location_address: str
    raw_address: NominatimAddress
    place_id: str | None
    osm_type: str | None
    osm_id: str | None


class ForwardGeocodeDict(TypedDict, total=False):
    """Result from forward geocoding operation."""

    latitude: float
    longitude: float
    location_name: str
    location_address: str
    raw_address: NominatimAddress
    place_id: str | None
    osm_type: str | None
    osm_id: str | None


class LocationSearchDict(TypedDict, total=False):
    """Result from location search operation."""

    latitude: float
    longitude: float
    location_name: str
    location_address: str
    raw_address: NominatimAddress
    place_id: str | None
    osm_type: str | None
    osm_id: str | None


class NearbyLocationDict(TypedDict, total=False):
    """Result from nearby location search."""

    latitude: float
    longitude: float
    name: str
    type: str | None
    class_: str | None
    place_id: str | None
    distance_km: float
