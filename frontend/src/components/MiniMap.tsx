import React, { useEffect, useMemo, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface MiniMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  size?: number;
  responsive?: boolean;
  aspectRatio?: "square" | "wide";
  className?: string;
  onClick?: () => void;
}

const MiniMap: React.FC<MiniMapProps> = ({
  latitude,
  longitude,
  zoom = 13,
  size = 120,
  responsive = false,
  aspectRatio = "square",
  className = "",
  onClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const DEFAULT_STYLE_URL = useMemo(
    () =>
      (import.meta as unknown as { env: { VITE_MAP_STYLE_URL?: string } }).env
        .VITE_MAP_STYLE_URL ||
      "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    [],
  );

  const getMapDimensions = () => {
    if (responsive) {
      return {
        width: "100%",
        height: aspectRatio === "square" ? "auto" : "200px",
        aspectRatio: aspectRatio === "square" ? "1" : undefined,
      };
    }
    return { width: `${size}px`, height: `${size}px` };
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: [longitude, latitude],
      zoom,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }));

    new maplibregl.Marker({ color: "#1f2937" })
      .setLngLat([longitude, latitude])
      .addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded border border-gray-200 ${
        onClick ? "cursor-pointer hover:border-blue-300" : ""
      } ${className}`}
      style={getMapDimensions()}
      onClick={onClick}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {onClick && (
        <div
          className="absolute inset-0 bg-transparent flex items-center justify-center"
          data-testid="mini-map-overlay"
        >
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
