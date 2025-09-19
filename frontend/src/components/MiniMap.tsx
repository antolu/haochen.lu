import React, { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { getTileConfig, getOptimizedMarkerIcon } from '../utils/mapUtils';

interface MiniMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  size?: number;
  responsive?: boolean;
  aspectRatio?: 'square' | 'wide';
  className?: string;
  onClick?: () => void;
}

const MiniMap: React.FC<MiniMapProps> = ({
  latitude,
  longitude,
  zoom = 13,
  size = 120,
  responsive = false,
  aspectRatio = 'square',
  className = '',
  onClick,
}) => {
  const tileConfig = useMemo(() => getTileConfig(), []);
  const marker = useMemo(() => {
    const iconConfig = getOptimizedMarkerIcon('small');
    return L.icon(iconConfig);
  }, []);

  const getMapDimensions = () => {
    if (responsive) {
      return {
        width: '100%',
        height: aspectRatio === 'square' ? 'auto' : '200px',
        aspectRatio: aspectRatio === 'square' ? '1' : undefined,
      };
    }
    return { width: size, height: size };
  };

  return (
    <div
      className={`relative overflow-hidden rounded border border-gray-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={getMapDimensions()}
      onClick={onClick}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer
          url={tileConfig.url}
          tileSize={tileConfig.tileSize}
          zoomOffset={tileConfig.zoomOffset}
          attribution={tileConfig.attribution}
        />
        <Marker position={[latitude, longitude]} icon={marker} />
      </MapContainer>

      {onClick && (
        <div className="absolute inset-0 bg-transparent flex items-center justify-center">
          <div className="bg-white bg-opacity-90 rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity duration-200">
            <svg
              className="h-4 w-4 text-blue-600"
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
        </div>
      )}
    </div>
  );
};

export default MiniMap;
