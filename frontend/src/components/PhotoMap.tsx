import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { Photo } from '../types';
import { formatDateSimple } from '../utils/dateFormat';

// Custom photo marker icon
const createPhotoMarker = (photoUrl: string) => {
  return L.divIcon({
    className: 'custom-photo-marker',
    html: `
      <div class="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden">
        <img src="${photoUrl}" class="w-full h-full object-cover" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

interface PhotoMapProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  height?: number;
  zoom?: number;
  className?: string;
}

// Component to fit map bounds to photos
const MapBounds: React.FC<{ photos: Photo[] }> = ({ photos }) => {
  const map = useMap();

  useEffect(() => {
    if (photos.length === 0) return;

    const bounds = L.latLngBounds([]);
    photos.forEach(photo => {
      if (photo.location_lat && photo.location_lon) {
        bounds.extend([photo.location_lat, photo.location_lon]);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, photos]);

  return null;
};

const PhotoMap: React.FC<PhotoMapProps> = ({
  photos,
  onPhotoClick,
  height = 400,
  zoom = 10,
  className = '',
}) => {
  // Filter photos that have location data
  const photosWithLocation = useMemo(() => {
    return photos.filter(photo => photo.location_lat && photo.location_lon);
  }, [photos]);

  // Default center (San Francisco)
  const defaultCenter: [number, number] = [37.7749, -122.4194];

  // Calculate center from photos or use default
  const mapCenter = useMemo((): [number, number] => {
    if (photosWithLocation.length === 0) return defaultCenter;

    if (photosWithLocation.length === 1) {
      return [photosWithLocation[0].location_lat!, photosWithLocation[0].location_lon!];
    }

    // Calculate average center
    const latSum = photosWithLocation.reduce((sum, photo) => sum + photo.location_lat!, 0);
    const lngSum = photosWithLocation.reduce((sum, photo) => sum + photo.location_lon!, 0);

    return [latSum / photosWithLocation.length, lngSum / photosWithLocation.length];
  }, [photosWithLocation]);

  if (photosWithLocation.length === 0) {
    return (
      <div
        className={`bg-gray-100 rounded-lg flex items-center justify-center ${className}`}
        style={{ height: `${height}px` }}
      >
        <div className="text-center text-gray-500">
          <svg
            className="h-12 w-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="font-medium">No geotagged photos</p>
          <p className="text-sm">Upload photos with GPS coordinates to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: `${height}px`, width: '100%' }}
        className="rounded-lg overflow-hidden"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBounds photos={photosWithLocation} />

        {photosWithLocation.map(photo => {
          // Get thumbnail URL - using variants system or fallback
          const thumbnailUrl = photo.variants?.thumbnail?.path || photo.original_path;

          return (
            <Marker
              key={photo.id}
              position={[photo.location_lat!, photo.location_lon!]}
              icon={createPhotoMarker(thumbnailUrl)}
              eventHandlers={{
                click: () => onPhotoClick?.(photo),
              }}
            >
              <Popup>
                <div className="min-w-0 max-w-xs">
                  <div className="aspect-video mb-2 rounded overflow-hidden">
                    <img
                      src={thumbnailUrl}
                      alt={photo.title || 'Photo'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="font-semibold text-sm mb-1 truncate">
                    {photo.title || 'Untitled'}
                  </h3>
                  {photo.location_name && (
                    <p className="text-xs text-gray-600 mb-1">📍 {photo.location_name}</p>
                  )}
                  {photo.date_taken && (
                    <p className="text-xs text-gray-500">📅 {formatDateSimple(photo.date_taken)}</p>
                  )}
                  {(photo.camera_make || photo.camera_model) && (
                    <p className="text-xs text-gray-500 mt-1">
                      📷 {photo.camera_make} {photo.camera_model}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <div className="mt-2 text-sm text-gray-500">
        Showing {photosWithLocation.length} geotagged photo
        {photosWithLocation.length !== 1 ? 's' : ''} of {photos.length} total
      </div>
    </div>
  );
};

export default PhotoMap;
