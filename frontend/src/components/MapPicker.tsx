import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl, {
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MapPickerProps {
  latitude?: number;
  longitude?: number;
  zoom?: number;
  height?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  onLocationChange?: (lat: number, lng: number) => void;
  disabled?: boolean;
  showSearch?: boolean;
  className?: string;
}

interface SearchResult {
  location_name: string;
  location_address?: string;
  latitude: number;
  longitude: number;
}

// Search component for location lookup
const LocationSearch: React.FC<{
  onLocationSelect: (lat: number, lng: number, name: string) => void;
}> = ({ onLocationSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/locations/search?q=${encodeURIComponent(searchQuery)}&limit=5`,
      );
      if (response.ok) {
        const data = (await response.json()) as SearchResult[];
        setResults(data);
      }
    } catch (error) {
      console.error("Error searching locations:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      void searchLocations(value);
    }, 300);
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery(result.location_name);
    setIsOpen(false);
    setResults([]);
    onLocationSelect(result.latitude, result.longitude, result.location_name);
  };

  return (
    <div className="relative mb-4">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for a location..."
          className="w-full pl-10 pr-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent"
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
      </div>

      {isOpen && (results.length > 0 || isLoading) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-muted-foreground">Searching...</div>
          ) : (
            results.map((result, index) => (
              <button
                key={index}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
                onClick={() => handleResultClick(result)}
              >
                <div className="font-medium text-gray-900">
                  {result.location_name}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  {result.location_address}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
};

const MapPicker: React.FC<MapPickerProps> = ({
  latitude = 37.7749, // Default to San Francisco
  longitude = -122.4194,
  zoom = 13,
  height = 400,
  onLocationSelect,
  onLocationChange,
  disabled = false,
  showSearch = true,
  className = "",
}) => {
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  const PREFERRED_DEFAULT_STYLE_URL =
    "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
  const FALLBACK_STYLE_URL = PREFERRED_DEFAULT_STYLE_URL;
  const DEFAULT_STYLE_URL = useMemo(
    () =>
      (import.meta as unknown as { env: { VITE_MAP_STYLE_URL?: string } }).env
        .VITE_MAP_STYLE_URL ?? PREFERRED_DEFAULT_STYLE_URL,
    [],
  );

  // Update internal state when props change
  useEffect(() => {
    setCurrentLat(latitude);
    setCurrentLng(longitude);
  }, [latitude, longitude]);

  const handleLocationSelect = useCallback(
    (lat: number, lng: number) => {
      setCurrentLat(lat);
      setCurrentLng(lng);
      onLocationSelect?.(lat, lng);
      onLocationChange?.(lat, lng);
    },
    [onLocationSelect, onLocationChange],
  );

  const handleSearchLocationSelect = useCallback(
    (lat: number, lng: number) => {
      handleLocationSelect(lat, lng);
    },
    [handleLocationSelect],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: [currentLng, currentLat],
      zoom,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "top-right",
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.on("error", (e: maplibregl.ErrorEvent) => {
      const maybeErr = (e as { error?: unknown })?.error;
      const msg = String((maybeErr as { message?: string })?.message ?? "");
      if (msg.includes("404") || msg.includes("Failed to fetch")) {
        try {
          map.setStyle(FALLBACK_STYLE_URL);
        } catch {
          // ignore
        }
      }
    });

    const marker = new maplibregl.Marker({ color: "#2563eb" })
      .setLngLat([currentLng, currentLat])
      .addTo(map);
    markerRef.current = marker;

    map.on("click", (e) => {
      if (disabled) return;
      const { lng, lat } = e.lngLat;
      marker.setLngLat([lng, lat]);
      handleLocationSelect(lat, lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [
    DEFAULT_STYLE_URL,
    FALLBACK_STYLE_URL,
    currentLat,
    currentLng,
    disabled,
    handleLocationSelect,
    zoom,
  ]);

  // Sync view/marker when state changes
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLngLat([currentLng, currentLat]);
    map.easeTo({ center: [currentLng, currentLat], zoom });
  }, [currentLat, currentLng, zoom]);

  return (
    <div className={className}>
      {showSearch && (
        <LocationSearch onLocationSelect={handleSearchLocationSelect} />
      )}

      <div className="relative">
        <div
          ref={containerRef}
          className="rounded-lg overflow-hidden"
          style={{ height: `${height}px`, width: "100%" }}
        />

        {disabled && (
          <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="bg-white px-3 py-2 rounded-lg shadow-sm text-gray-600">
              Map disabled
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <div className="mt-2 text-sm text-muted-foreground">
          Click on the map to select a location • Coordinates:{" "}
          {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default MapPicker;
