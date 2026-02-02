import React, { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const DEFAULT_STYLE_URL = useMemo(
    () =>
      (import.meta as unknown as { env: { VITE_MAP_STYLE_URL?: string } }).env
        .VITE_MAP_STYLE_URL ??
      "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: [longitude, latitude],
      zoom,
      minZoom,
      maxZoom,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    new maplibregl.Marker({ color: "#2563eb" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude, zoom, minZoom, maxZoom, DEFAULT_STYLE_URL]);

  return (
    <div
      className={`relative overflow-hidden rounded border border-gray-200 ${className}`}
      style={{ width, height }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

export default InteractiveMap;
