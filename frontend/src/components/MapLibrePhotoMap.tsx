import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Photo } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface MapLibrePhotoMapProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  height?: number;
  className?: string;
  zoom?: number;
}

const hasLocation = (photo: Photo): boolean => {
  return (
    typeof photo.location_lat === "number" &&
    typeof photo.location_lon === "number" &&
    !Number.isNaN(photo.location_lat) &&
    !Number.isNaN(photo.location_lon)
  );
};

const PREFERRED_DEFAULT_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const FALLBACK_STYLE_URL = PREFERRED_DEFAULT_STYLE_URL;
const DEFAULT_STYLE_URL =
  (import.meta as unknown as { env: { VITE_MAP_STYLE_URL?: string } }).env
    .VITE_MAP_STYLE_URL || PREFERRED_DEFAULT_STYLE_URL;

const MapLibrePhotoMap: React.FC<MapLibrePhotoMapProps> = ({
  photos,
  onPhotoClick,
  height = 650,
  className = "",
  zoom,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pointMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<number, maplibregl.Marker>>(new Map());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhotos, setModalPhotos] = useState<Photo[]>([]);
  const [lastModalZoomKey, setLastModalZoomKey] = useState<string | null>(null);

  const photosWithLocation = useMemo(
    () => photos.filter((p) => hasLocation(p)),
    [photos],
  );

  const idToPhoto = useMemo(() => {
    const mapObj = new globalThis.Map<string, Photo>();
    for (const p of photosWithLocation) {
      mapObj.set(p.id, p);
    }
    return mapObj;
  }, [photosWithLocation]);

  type PointProps = { id: string; title?: string };
  type ClusterProps = {
    cluster: true;
    cluster_id: number;
    point_count: number;
  };
  type ClusterFeature = GeoJSON.Feature<
    GeoJSON.Point,
    PointProps | ClusterProps
  >;

  const pointFeatures = useMemo<GeoJSON.Feature<GeoJSON.Point, PointProps>[]>(
    () =>
      photosWithLocation.map((p) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [p.location_lon as number, p.location_lat as number],
        },
        properties: { id: p.id, title: p.title || "Untitled" },
      })),
    [photosWithLocation],
  );

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<PointProps, ClusterProps>({
      radius: 50,
      maxZoom: 16,
    });
    index.load(pointFeatures);
    return index;
  }, [pointFeatures]);

  const getThumbnailUrl = (p: Photo): string => {
    const variants = p.variants || {};
    const thumb =
      (variants as any).thumbnail?.url || (variants as any).small?.url;
    return thumb || p.original_url || `/uploads/${p.filename}`;
  };

  const createPhotoMarkerElement = (photo: Photo): HTMLDivElement => {
    // Outer wrapper keeps constant size so the marker anchor doesn't shift
    const outer = document.createElement("div");
    outer.style.width = "44px";
    outer.style.height = "44px";
    outer.style.borderRadius = "9999px";
    outer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
    outer.style.border = "2px solid #fff";
    outer.style.overflow = "hidden";
    outer.style.cursor = "pointer";
    outer.style.position = "relative";

    // Inner element scales on hover
    const inner = document.createElement("div");
    inner.style.position = "absolute";
    inner.style.inset = "0";
    inner.style.background = `center/cover no-repeat url('${getThumbnailUrl(photo)}')`;
    inner.style.transition = "transform 150ms ease";
    inner.style.transformOrigin = "center center";

    outer.addEventListener("mouseenter", () => {
      inner.style.transform = "scale(1.2)";
      outer.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)";
    });
    outer.addEventListener("mouseleave", () => {
      inner.style.transform = "scale(1)";
      outer.style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
    });

    outer.appendChild(inner);
    return outer;
  };

  const createClusterMarkerElement = (
    imageUrls: string[],
    count: number,
  ): HTMLDivElement => {
    // Outer wrapper keeps constant size so the marker anchor doesn't shift
    const container = document.createElement("div");
    container.style.width = "56px";
    container.style.height = "56px";
    container.style.borderRadius = "9999px";
    container.style.background = "#1d4ed8";
    container.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
    container.style.border = "2px solid #fff";
    container.style.position = "relative";
    container.style.overflow = "hidden";
    container.style.cursor = "pointer";

    // Inner scales on hover
    const scaleWrap = document.createElement("div");
    scaleWrap.style.position = "absolute";
    scaleWrap.style.inset = "0";
    scaleWrap.style.transition = "transform 150ms ease";
    scaleWrap.style.transformOrigin = "center center";
    container.appendChild(scaleWrap);

    const grid = document.createElement("div");
    grid.style.position = "absolute";
    grid.style.inset = "0";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gridTemplateRows = "1fr 1fr";
    scaleWrap.appendChild(grid);

    for (let i = 0; i < Math.min(4, imageUrls.length); i++) {
      const cell = document.createElement("div");
      cell.style.backgroundImage = `url('${imageUrls[i]}')`;
      cell.style.backgroundSize = "cover";
      cell.style.backgroundPosition = "center";
      grid.appendChild(cell);
    }

    // Count badge
    const badge = document.createElement("div");
    badge.textContent = String(count);
    badge.style.position = "absolute";
    badge.style.right = "-2px";
    badge.style.bottom = "-2px";
    badge.style.background = "#111827";
    badge.style.color = "#fff";
    badge.style.fontSize = "12px";
    badge.style.padding = "2px 6px";
    badge.style.borderTopLeftRadius = "10px";
    container.appendChild(badge);

    container.addEventListener("mouseenter", () => {
      scaleWrap.style.transform = "scale(1.12)";
      container.style.boxShadow = "0 4px 18px rgba(0,0,0,0.4)";
    });
    container.addEventListener("mouseleave", () => {
      scaleWrap.style.transform = "scale(1)";
      container.style.boxShadow = "0 2px 12px rgba(0,0,0,0.3)";
    });

    return container;
  };

  const computeBounds = (): LngLatBoundsLike | null => {
    if (photosWithLocation.length === 0) return null;
    const bounds = new maplibregl.LngLatBounds();
    for (const p of photosWithLocation) {
      bounds.extend([p.location_lon as number, p.location_lat as number]);
    }
    return bounds;
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE_URL,
      center: [0, 0],
      zoom: zoom ?? 2,
      attributionControl: false,
      cooperativeGestures: true,
    });

    mapRef.current = map;

    // Fallback if style fails to load
    map.on("error", (e: any) => {
      const msg = String(e?.error?.message || "");
      if (msg.includes("404") || msg.includes("Failed to fetch")) {
        try {
          map.setStyle(FALLBACK_STYLE_URL);
        } catch {}
      }
    });

    map.on("load", () => {
      // Zoom/navigation controls
      map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: false }),
        "top-right",
      );
      // Add attribution control with compact option
      map.addControl(new maplibregl.AttributionControl({ compact: true }));
      const haversineMeters = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
      ) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371000; // meters
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const updateHtmlMarkers = () => {
        const b = map.getBounds();
        const clusters = clusterIndex.getClusters(
          [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
          Math.floor(map.getZoom()),
        ) as ClusterFeature[];

        const visibleClusterIds = new Set<number>();
        const visiblePhotoIds = new Set<string>();

        for (const f of clusters) {
          const coords = (f.geometry as any).coordinates as [number, number];
          const props = f.properties as any;
          if (props.cluster) {
            const clusterId = props.cluster_id as number;
            visibleClusterIds.add(clusterId);
            if (!clusterMarkersRef.current.has(clusterId)) {
              const leaves = clusterIndex.getLeaves(clusterId, 4, 0);
              const urls = leaves
                .map((leaf: any) => idToPhoto.get(leaf.properties.id as string))
                .filter((p): p is Photo => Boolean(p))
                .map((p) => getThumbnailUrl(p));
              const el = createClusterMarkerElement(
                urls,
                props.point_count as number,
              );
              const marker = new maplibregl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map);

              el.addEventListener("click", () => {
                const nextZoom =
                  clusterIndex.getClusterExpansionZoom(clusterId);
                map.easeTo({ center: coords, zoom: nextZoom });
              });

              clusterMarkersRef.current.set(clusterId, marker);
            } else {
              clusterMarkersRef.current.get(clusterId)!.setLngLat(coords);
            }
          } else {
            const id = (props.id as string) || "";
            if (!id) continue;
            visiblePhotoIds.add(id);
            const photo = idToPhoto.get(id);
            if (!photo) continue;
            if (!pointMarkersRef.current.has(id)) {
              const el = createPhotoMarkerElement(photo);
              const marker = new maplibregl.Marker({ element: el })
                .setLngLat(coords)
                .addTo(map);
              el.addEventListener("click", () => {
                if (onPhotoClick) onPhotoClick(photo);
                const popupHtml = `
                  <div style=\"width: 220px;\">\n                    <div style=\"width:100%;height:140px;border-radius:8px;overflow:hidden;background:#000;margin-bottom:8px;\">\n                      <img src=\"${getThumbnailUrl(photo)}\" style=\"width:100%;height:100%;object-fit:cover;\" />\n                    </div>\n                    <div style=\"font-weight:600;color:#111827;\">${photo.title || "Untitled"}</div>\n                    <div style=\"font-size:12px;color:#6b7280;margin-top:2px;\">${photo.location_name || ""}</div>\n                    <div style=\"font-size:12px;color:#9ca3af;\">${photo.date_taken || ""}</div>\n                  </div>`;
                new maplibregl.Popup({ offset: 12 })
                  .setLngLat(coords)
                  .setHTML(popupHtml)
                  .addTo(map);
              });
              pointMarkersRef.current.set(id, marker);
            } else {
              pointMarkersRef.current.get(id)!.setLngLat(coords);
            }
          }
        }

        // Cleanup offscreen markers
        for (const [cid, marker] of clusterMarkersRef.current) {
          if (!visibleClusterIds.has(cid)) {
            marker.remove();
            clusterMarkersRef.current.delete(cid);
          }
        }
        for (const [pid, marker] of pointMarkersRef.current) {
          if (!visiblePhotoIds.has(pid)) {
            marker.remove();
            pointMarkersRef.current.delete(pid);
          }
        }

        // Trigger modal when within ~10km and multiple points visible
        const centerLat = (b.getNorth() + b.getSouth()) / 2;
        const widthMeters = haversineMeters(
          centerLat,
          b.getWest(),
          centerLat,
          b.getEast(),
        );
        const widthKm = widthMeters / 1000;
        if (widthKm <= 10 && visiblePhotoIds.size > 1) {
          const key = `${Math.round(widthKm * 10) / 10}-${Array.from(
            visiblePhotoIds,
          )
            .sort()
            .slice(0, 4)
            .join("")}`;
          if (!modalOpen && key !== lastModalZoomKey) {
            setLastModalZoomKey(key);
            const photosToShow: Photo[] = Array.from(visiblePhotoIds)
              .map((id) => idToPhoto.get(id))
              .filter((p): p is Photo => Boolean(p));
            setModalPhotos(photosToShow);
            setModalOpen(true);
          }
        }
      };

      map.on("moveend", updateHtmlMarkers);
      map.on("zoomend", updateHtmlMarkers);
      updateHtmlMarkers();

      const bounds = computeBounds();
      if (bounds) {
        map.fitBounds(bounds, { padding: 40, animate: true, duration: 800 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      // Cleanup markers
      for (const [, m] of pointMarkersRef.current) m.remove();
      for (const [, m] of clusterMarkersRef.current) m.remove();
      pointMarkersRef.current.clear();
      clusterMarkersRef.current.clear();
    };
  }, []);

  // Update clusters when inputs change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = computeBounds();
    if (bounds) {
      map.fitBounds(bounds, { padding: 40, animate: true, duration: 600 });
    }
    map.fire("moveend");
  }, [clusterIndex]);

  return (
    <div className={className} style={{ height: `${height}px`, width: "100%" }}>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Photos in this area</DialogTitle>
            <DialogDescription>
              Showing {modalPhotos.length} photos within approximately 10 km
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {modalPhotos.map((p) => (
              <button
                key={p.id}
                className="relative group rounded-md overflow-hidden border"
                onClick={() => {
                  if (onPhotoClick) onPhotoClick(p);
                  setModalOpen(false);
                }}
              >
                <img
                  src={getThumbnailUrl(p)}
                  alt={p.title || "Photo"}
                  className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-xs p-1 truncate">
                  {p.title || "Untitled"}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MapLibrePhotoMap;
