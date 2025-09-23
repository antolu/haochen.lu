import React, { useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { getTileConfig, getOptimizedMarkerIcon } from "../utils/mapUtils";

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
  width = "100%",
  height = 400,
  className = "",
  minZoom = 3,
  maxZoom = 18,
}) => {
  const tileConfig = useMemo(() => getTileConfig(), []);
  const marker = useMemo(() => {
    const iconConfig = getOptimizedMarkerIcon("large");
    return L.icon(iconConfig);
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
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        attributionControl={true}
      >
        <TileLayer
          url={tileConfig.url}
          tileSize={tileConfig.tileSize}
          zoomOffset={tileConfig.zoomOffset}
          attribution={tileConfig.attribution}
        />
        <Marker position={[latitude, longitude]} icon={marker} />
      </MapContainer>
    </div>
  );
};

export default InteractiveMap;
