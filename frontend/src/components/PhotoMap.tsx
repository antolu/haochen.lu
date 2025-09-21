import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Photo } from '../types';
import { formatDateSimple } from '../utils/dateFormat';
import { getTileConfig } from '../utils/mapUtils';
import './PhotoMap.css';

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

// Custom cluster icon for grouped photos with thumbnail preview
const createClusterIcon = (cluster: any) => {
  const count = cluster.getChildCount();
  const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';

  // Get first few photos for preview
  const childMarkers = cluster.getAllChildMarkers();
  const previewPhotos = childMarkers.slice(0, 4).map((marker: any) => {
    const photo = marker.options.photo;
    return photo.variants?.thumbnail?.path || photo.original_path;
  });

  // Create thumbnail grid for clusters with 4+ photos
  const thumbnailGrid =
    count >= 4
      ? `
    <div class="cluster-thumbnails">
      ${previewPhotos.map((url: string) => `<img src="${url}" class="cluster-thumb" />`).join('')}
    </div>
  `
      : '';

  return L.divIcon({
    html: `
      <div class="cluster-marker cluster-marker-${size}">
        ${thumbnailGrid}
        <div class="cluster-count">
          <span>${count}</span>
        </div>
      </div>
    `,
    className: 'photo-cluster-marker',
    iconSize: L.point(
      count < 10 ? 40 : count < 100 ? 50 : 60,
      count < 10 ? 40 : count < 100 ? 50 : 60,
      true
    ),
  });
};

interface PhotoMapProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  height?: number;
  zoom?: number;
  className?: string;
}

// Component to handle cluster events
const ClusterEvents: React.FC<{ onPhotoClick?: (photo: Photo) => void }> = ({ onPhotoClick }) => {
  const map = useMap();

  useEffect(() => {
    map.on('cluster:click', (event: any) => {
      const cluster = event.layer;
      const childMarkers = cluster.getAllChildMarkers();

      // Create popup content with all photos in cluster
      const photos = childMarkers.map((marker: any) => marker.options.photo);

      const popupContent = document.createElement('div');
      popupContent.className = 'cluster-popup';
      popupContent.innerHTML = `
        <div class="cluster-popup-header">
          <h3 class="font-semibold text-sm mb-2">${photos.length} photos at this location</h3>
        </div>
        <div class="cluster-popup-grid">
          ${photos
            .map((photo: Photo) => {
              const thumbnailUrl = photo.variants?.thumbnail?.path || photo.original_path;
              return `
              <div class="cluster-popup-item" data-photo-id="${photo.id}">
                <img src="${thumbnailUrl}" alt="${photo.title || 'Photo'}" class="cluster-popup-thumb" />
                <div class="cluster-popup-info">
                  <p class="font-medium text-xs truncate">${photo.title || 'Untitled'}</p>
                  ${photo.date_taken ? `<p class="text-xs text-gray-500">${new Date(photo.date_taken).toLocaleDateString()}</p>` : ''}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `;

      // Add click handlers for individual photos
      popupContent.querySelectorAll('.cluster-popup-item').forEach((item: any) => {
        item.addEventListener('click', () => {
          const photoId = item.dataset.photoId;
          const photo = photos.find((p: Photo) => p.id === photoId);
          if (photo && onPhotoClick) {
            onPhotoClick(photo);
          }
        });
      });

      // Show popup at cluster location
      L.popup({
        maxWidth: 300,
        className: 'cluster-popup-container',
      })
        .setLatLng(cluster.getLatLng())
        .setContent(popupContent)
        .openOn(map);
    });

    return () => {
      map.off('cluster:click');
    };
  }, [map, onPhotoClick]);

  return null;
};

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
  const tileConfig = useMemo(() => getTileConfig(), []);

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
          url={tileConfig.url}
          tileSize={tileConfig.tileSize}
          zoomOffset={tileConfig.zoomOffset}
          attribution={tileConfig.attribution}
        />

        <MapBounds photos={photosWithLocation} />
        <ClusterEvents onPhotoClick={onPhotoClick} />

        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={createClusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
        >
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
                      <p className="text-xs text-gray-500">
                        📅 {formatDateSimple(photo.date_taken)}
                      </p>
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
        </MarkerClusterGroup>
      </MapContainer>

      <div className="mt-2 text-sm text-gray-500">
        Showing {photosWithLocation.length} geotagged photo
        {photosWithLocation.length !== 1 ? 's' : ''} of {photos.length} total
      </div>
    </div>
  );
};

export default PhotoMap;
