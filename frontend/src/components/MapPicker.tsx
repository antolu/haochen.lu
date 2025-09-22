import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { getTileConfig } from '../utils/mapUtils';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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

interface MapEventsProps {
  onLocationSelect?: (lat: number, lng: number) => void;
  disabled?: boolean;
}

interface SearchResult {
  location_name: string;
  location_address?: string;
  latitude: number;
  longitude: number;
}

// Component to handle map click events
const MapEvents: React.FC<MapEventsProps> = ({ onLocationSelect, disabled }) => {
  useMapEvents({
    click: e => {
      if (!disabled && onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

// Component to update map view when coordinates change
const MapController: React.FC<{
  latitude: number;
  longitude: number;
  zoom: number;
}> = ({ latitude, longitude, zoom }) => {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);

  return null;
};

// Search component for location lookup
const LocationSearch: React.FC<{
  onLocationSelect: (lat: number, lng: number, name: string) => void;
}> = ({ onLocationSelect }) => {
  const [query, setQuery] = useState('');
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
        `/api/locations/search?q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      if (response.ok) {
        const data = (await response.json()) as SearchResult[];
        setResults(data);
      }
    } catch (error) {
      console.error('Error searching locations:', error);
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
          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-gray-500">Searching...</div>
          ) : (
            results.map((result, index) => (
              <button
                key={index}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
                onClick={() => handleResultClick(result)}
              >
                <div className="font-medium text-gray-900">{result.location_name}</div>
                <div className="text-sm text-gray-500 truncate">{result.location_address}</div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />}
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
  className = '',
}) => {
  const tileConfig = useMemo(() => getTileConfig(), []);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);

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
    [onLocationSelect, onLocationChange]
  );

  const handleSearchLocationSelect = useCallback(
    (lat: number, lng: number) => {
      handleLocationSelect(lat, lng);
    },
    [handleLocationSelect]
  );

  return (
    <div className={className}>
      {showSearch && <LocationSearch onLocationSelect={handleSearchLocationSelect} />}

      <div className="relative">
        <MapContainer
          center={[currentLat, currentLng]}
          zoom={zoom}
          style={{ height: `${height}px`, width: '100%' }}
          className="rounded-lg overflow-hidden"
          data-testid="map-picker-container"
        >
          <TileLayer
            url={tileConfig.url}
            tileSize={tileConfig.tileSize}
            zoomOffset={tileConfig.zoomOffset}
            attribution={tileConfig.attribution}
          />

          <MapEvents onLocationSelect={handleLocationSelect} disabled={disabled} />

          <MapController latitude={currentLat} longitude={currentLng} zoom={zoom} />

          <Marker position={[currentLat, currentLng]} />
        </MapContainer>

        {disabled && (
          <div className="absolute inset-0 bg-gray-200 bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="bg-white px-3 py-2 rounded-lg shadow-sm text-gray-600">
              Map disabled
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <div className="mt-2 text-sm text-gray-500">
          Click on the map to select a location • Coordinates: {currentLat.toFixed(6)},{' '}
          {currentLng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default MapPicker;
