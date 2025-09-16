import React, { useState, useCallback } from 'react';
import MapPicker from './MapPicker';

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
  className = '',
}) => {
  const [showMap, setShowMap] = useState(false);
  const [manualLocationName, setManualLocationName] = useState(locationName || '');

  const handleLocationSelect = useCallback(
    async (lat: number, lng: number) => {
      // Try to get location name from coordinates
      try {
        const response = await fetch(
          `/api/locations/reverse?lat=${lat}&lng=${lng}`
        );
        if (response.ok) {
          const data = await response.json();
          setManualLocationName(data.location_name || '');
          onLocationChange?.(lat, lng, data.location_name);
        } else {
          onLocationChange?.(lat, lng);
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
        onLocationChange?.(lat, lng);
      }
    },
    [onLocationChange]
  );

  const handleLocationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setManualLocationName(name);
    if (latitude && longitude) {
      onLocationChange?.(latitude, longitude, name);
    }
  };

  const handleMapToggle = () => {
    setShowMap(!showMap);
  };

  const hasCoordinates = latitude !== undefined && longitude !== undefined;

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Location Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location Name
          </label>
          <input
            type="text"
            value={manualLocationName}
            onChange={handleLocationNameChange}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude
            </label>
            <input
              type="number"
              step="any"
              value={latitude || ''}
              onChange={(e) => {
                const lat = parseFloat(e.target.value);
                if (!isNaN(lat) && longitude !== undefined) {
                  handleLocationSelect(lat, longitude);
                }
              }}
              placeholder="0.000000"
              disabled={disabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude
            </label>
            <input
              type="number"
              step="any"
              value={longitude || ''}
              onChange={(e) => {
                const lng = parseFloat(e.target.value);
                if (!isNaN(lng) && latitude !== undefined) {
                  handleLocationSelect(latitude, lng);
                }
              }}
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
            onClick={handleMapToggle}
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
            {showMap ? 'Hide Map' : 'Pick from Map'}
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
              onLocationSelect={handleLocationSelect}
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
                    handleLocationSelect(
                      position.coords.latitude,
                      position.coords.longitude
                    );
                  },
                  (error) => {
                    console.error('Error getting current location:', error);
                    alert('Unable to get your current location. Please check your browser permissions.');
                  }
                );
              } else {
                alert('Geolocation is not supported by this browser.');
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
    </div>
  );
};

export default LocationInput;