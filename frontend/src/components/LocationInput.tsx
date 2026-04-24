import React, { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import MapPicker from "./MapPicker";

interface LocationInputProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  onLocationChange?: (lat: number, lng: number, name?: string) => void;
  disabled?: boolean;
  className?: string;
}

const LocationInput: React.FC<LocationInputProps> = ({
  latitude,
  longitude,
  locationName,
  onLocationChange,
  disabled = false,
  className = "",
}) => {
  const [showMap, setShowMap] = useState(false);
  const [manualLocationName, setManualLocationName] = useState(
    locationName ?? "",
  );
  const [searchQuery, setSearchQuery] = useState("");
  type SearchResult = {
    location_name: string;
    location_address?: string;
    latitude: number;
    longitude: number;
  };
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const updateDropdownPosition = useCallback(() => {
    if (searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  // Update dropdown position on window resize/scroll
  useEffect(() => {
    const handleResize = () => {
      if (showSearchResults) {
        updateDropdownPosition();
      }
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [showSearchResults, updateDropdownPosition]);

  const handleLocationSelect = useCallback(
    async (lat: number, lng: number): Promise<void> => {
      // Try to get location name from coordinates
      try {
        const response = await fetch(
          `/api/locations/reverse?lat=${lat}&lng=${lng}`,
        );
        if (response.ok) {
          const data = (await response.json()) as { location_name?: string };
          setManualLocationName(data.location_name ?? "");
          onLocationChange?.(lat, lng, data.location_name);
        } else {
          onLocationChange?.(lat, lng);
        }
      } catch (error) {
        console.error("Error reverse geocoding:", error);
        onLocationChange?.(lat, lng);
      }
    },
    [onLocationChange],
  );

  const searchLocations = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/locations/search?q=${encodeURIComponent(query)}&limit=5`,
        );
        if (response.ok) {
          const data = (await response.json()) as SearchResult[];
          setSearchResults(data);
          updateDropdownPosition();
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error("Error searching locations:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [updateDropdownPosition],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const query = e.target.value;
    setSearchQuery(query);
    setManualLocationName(query);

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      void searchLocations(query);
    }, 300);
  };

  const handleSearchResultSelect = (result: {
    location_name: string;
    location_address?: string;
    latitude: number;
    longitude: number;
  }): void => {
    setSearchQuery(result.location_name);
    setManualLocationName(result.location_name);
    setShowSearchResults(false);
    setSearchResults([]);
    onLocationChange?.(result.latitude, result.longitude, result.location_name);
  };

  // Note: location name changes are handled via search input events

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    // Prevent form submission on Enter
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      // If search results are showing and there's a first result, select it
      if (showSearchResults && searchResults.length > 0) {
        handleSearchResultSelect(searchResults[0]);
      }
    }

    // Handle Escape to close search results
    if (e.key === "Escape") {
      setShowSearchResults(false);
    }
  };

  const handleMapToggle = () => {
    setShowMap(!showMap);
  };

  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Location Search Input */}
        <div className="relative">
          <label
            htmlFor="search-location-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search Location
          </label>
          <div className="relative">
            <input
              id="search-location-input"
              ref={searchInputRef}
              type="text"
              value={searchQuery || manualLocationName}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (searchResults.length > 0) {
                  updateDropdownPosition();
                  setShowSearchResults(true);
                }
              }}
              placeholder="Search for a location..."
              disabled={disabled}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {isSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500 mt-1">
            Type to search for locations and GPS coordinates will be set
            automatically
          </p>
        </div>

        {/* Location Name Input */}
        <div>
          <label
            htmlFor="location-name-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Location Name
          </label>
          <input
            id="location-name-input"
            type="text"
            value={manualLocationName}
            onChange={(e) => {
              setManualLocationName(e.target.value);
              if (latitude !== undefined && longitude !== undefined) {
                onLocationChange?.(latitude, longitude, e.target.value);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Enter location name or let it be auto-detected"
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">
            Override the auto-detected location name if needed
          </p>
        </div>

        {/* Coordinates Display/Input */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="latitude-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Latitude
            </label>
            <input
              id="latitude-input"
              type="number"
              step="any"
              value={latitude ?? ""}
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!isNaN(lat) && longitude !== undefined) {
                  void handleLocationSelect(lat, longitude);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="0.000000"
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>
          <div>
            <label
              htmlFor="longitude-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Longitude
            </label>
            <input
              id="longitude-input"
              type="number"
              step="any"
              value={longitude ?? ""}
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!isNaN(lng) && latitude !== undefined) {
                  void handleLocationSelect(latitude, lng);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="0.000000"
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>
        </div>

        {/* Map Toggle Button */}
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => handleMapToggle()}
            disabled={disabled}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="h-4 w-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {showMap ? "Hide Map" : "Pick from Map"}
          </button>

          {hasCoordinates && (
            <div className="text-sm text-gray-500">
              📍 {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
            </div>
          )}
        </div>

        {/* Map Picker */}
        {showMap && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <MapPicker
              latitude={latitude}
              longitude={longitude}
              onLocationSelect={(lat, lng) => {
                void handleLocationSelect(lat, lng);
              }}
              disabled={disabled}
              showSearch={true}
              height={350}
            />
          </div>
        )}

        {/* Current Location Button */}
        {!disabled && (
          <button
            type="button"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    void handleLocationSelect(
                      position.coords.latitude,
                      position.coords.longitude,
                    );
                  },
                  (error) => {
                    console.error("Error getting current location:", error);
                    alert(
                      "Unable to get your current location. Please check your browser permissions.",
                    );
                  },
                );
              } else {
                alert("Geolocation is not supported by this browser.");
              }
            }}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              className="h-4 w-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Use Current Location
          </button>
        )}
      </div>

      {/* Portal for Search Results Dropdown */}
      {showSearchResults &&
        (searchResults.length > 0 || isSearching) &&
        createPortal(
          <>
            {/* Overlay to close dropdown */}
            <div
              className="fixed inset-0"
              style={{ zIndex: 9998 }}
              onClick={() => setShowSearchResults(false)}
            />

            {/* Search Results Dropdown */}
            <div
              className="absolute bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
              style={{
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                zIndex: 9999,
              }}
            >
              {isSearching ? (
                <div className="px-3 py-2 text-gray-500">Searching...</div>
              ) : (
                searchResults.map((result, index) => (
                  <button
                    key={index}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => handleSearchResultSelect(result)}
                  >
                    <div className="font-medium text-gray-900">
                      {result.location_name}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {result.location_address}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};

export default LocationInput;
