import React, { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

interface InteractiveMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  minZoom?: number;
  maxZoom?: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  latitude,
  longitude,
  zoom = 13,
  width = '100%',
  height = 400,
  className = '',
  minZoom = 3,
  maxZoom = 18,
}) => {
  const marker = useMemo(() => {
    return L.icon({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconRetinaUrl:
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
      shadowAnchor: [12, 41],
    });
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded border border-gray-200 ${className}`}
      style={{ width, height }}
    >
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <Marker position={[latitude, longitude]} icon={marker} />
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;
