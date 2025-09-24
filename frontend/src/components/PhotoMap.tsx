import React, { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet.markercluster";
import type { Photo } from "../types";
import { formatDateSimple } from "../utils/dateFormat";
import { getTileConfig } from "../utils/mapUtils";
import "./PhotoMap.css";

// Custom photo marker icon
const createPhotoMarker = (photoUrl: string) => {
  return L.divIcon({
    className: "custom-photo-marker",
    html: `
      <div class="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden">
        <img src="${photoUrl}" class="w-full h-full object-cover" />
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

type MarkerWithPhotoOptions = L.MarkerOptions & { photo?: Photo };

type MarkerWithPhoto = L.Marker & { options: MarkerWithPhotoOptions };

type MarkerClusterWithPhotos = L.MarkerCluster & {
  getAllChildMarkers(): MarkerWithPhoto[];
  getLatLng(): L.LatLng;
};

const hasLocation = (
  photo: Photo,
): photo is Photo & {
  location_lat: number;
  location_lon: number;
} =>
  photo.location_lat !== null &&
  photo.location_lat !== undefined &&
  photo.location_lon !== null &&
  photo.location_lon !== undefined;

const getClusterMarkers = (cluster: L.MarkerCluster): MarkerWithPhoto[] => {
  const markers = cluster.getAllChildMarkers();
  if (!Array.isArray(markers)) {
    return [];
  }

  return markers
    .filter((marker): marker is MarkerWithPhoto => marker instanceof L.Marker)
    .map((marker) => marker);
};

// Custom cluster icon for grouped photos with thumbnail preview
const createClusterIcon = (cluster: MarkerClusterWithPhotos) => {
  const count = cluster.getChildCount();
  const size = count < 10 ? "small" : count < 100 ? "medium" : "large";

  // Get first few photos for preview
  const childMarkers = getClusterMarkers(cluster);
  const previewPhotos = childMarkers.slice(0, 4).map((marker) => {
    const p = marker.options.photo;
    const url = p?.variants?.thumbnail?.url ?? p?.original_url;
    return url ?? "";
  });

  // Create thumbnail grid for clusters with 4+ photos
  const thumbnailGrid =
    count >= 4
      ? `
    <div class="cluster-thumbnails">
      ${previewPhotos
        .filter((url): url is string => typeof url === "string")
        .map((url: string) => `<img src="${url}" class="cluster-thumb" />`)
        .join("")}
    </div>
  `
      : "";

  return L.divIcon({
    html: `
      <div class="cluster-marker cluster-marker-${size}">
        ${thumbnailGrid}
        <div class="cluster-count">
          <span>${count}</span>
        </div>
      </div>
    `,
    className: "photo-cluster-marker",
    iconSize: L.point(
      count < 10 ? 40 : count < 100 ? 50 : 60,
      count < 10 ? 40 : count < 100 ? 50 : 60,
      true,
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

// Add a cluster layer using leaflet.markercluster directly
const ClusterLayer: React.FC<{
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
}> = ({ photos, onPhotoClick }) => {
  const map = useMap();

  useEffect(() => {
    if (!photos.length) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: createClusterIcon,
    });

    // Add markers
    photos.forEach((photo) => {
      if (hasLocation(photo)) {
        const thumbnailUrl =
          photo.variants?.thumbnail?.url ??
          photo.original_url ??
          `/uploads/${photo.filename}`;

        const marker = L.marker([photo.location_lat, photo.location_lon], {
          icon: createPhotoMarker(thumbnailUrl),
        }) as MarkerWithPhoto;
        marker.options.photo = photo;

        marker.on("click", () => {
          onPhotoClick?.(photo);
        });

        // Optional popup for each marker
        marker.bindPopup(
          `<div class="min-w-0 max-w-xs">
             <div class="aspect-video mb-2 rounded overflow-hidden">
               <img src="${thumbnailUrl}" alt="${photo.title || "Photo"}" class="w-full h-full object-cover" />
             </div>
             <h3 class="font-semibold text-sm mb-1 truncate">${photo.title || "Untitled"}</h3>
             ${photo.location_name ? `<p class="text-xs text-gray-600 mb-1">📍 ${photo.location_name}</p>` : ""}
             ${photo.date_taken ? `<p class="text-xs text-gray-500">📅 ${formatDateSimple(photo.date_taken)}</p>` : ""}
           </div>`,
        );

        clusterGroup.addLayer(marker);
      }
    });

    // Cluster click popup with preview grid
    clusterGroup.on(
      "clusterclick",
      (e: L.LeafletEvent & { layer: L.MarkerCluster }) => {
        const cluster = e.layer as MarkerClusterWithPhotos;
        const childMarkers = getClusterMarkers(cluster);
        const photosInCluster = childMarkers
          .map((m) => m.options.photo)
          .filter((p): p is Photo => Boolean(p));

        const popupContent = document.createElement("div");
        popupContent.className = "cluster-popup";
        popupContent.innerHTML = `
        <div class="cluster-popup-header">
          <h3 class="font-semibold text-sm mb-2">${photosInCluster.length} photos at this location</h3>
        </div>
        <div class="cluster-popup-grid">
          ${photosInCluster
            .map((p) => {
              const url = p.variants?.thumbnail?.url ?? p.original_url ?? "";
              return `
                <div class="cluster-popup-item" data-photo-id="${p.id}">
                  <img src="${url}" alt="${p.title ?? "Photo"}" class="cluster-popup-thumb" />
                  <div class="cluster-popup-info">
                    <p class="font-medium text-xs truncate">${p.title ?? "Untitled"}</p>
                    ${p.date_taken ? `<p class="text-xs text-gray-500">${new Date(p.date_taken).toLocaleDateString()}</p>` : ""}
                  </div>
                </div>`;
            })
            .join("")}
        </div>`;

        // Click handlers
        popupContent.querySelectorAll(".cluster-popup-item").forEach((item) => {
          const element = item as HTMLElement;
          element.addEventListener("click", () => {
            const photoId = element.dataset.photoId;
            const p = photosInCluster.find((ph) => ph.id === photoId);
            if (p && onPhotoClick) onPhotoClick(p);
          });
        });

        const popup = L.popup({
          maxWidth: 300,
          className: "cluster-popup-container",
        });
        popup.setLatLng(cluster.getLatLng());
        popup.setContent(popupContent);
        popup.openOn(map);
      },
    );

    map.addLayer(clusterGroup);

    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, photos, onPhotoClick]);

  return null;
};

// Component to fit map bounds to photos
const MapBounds: React.FC<{ photos: Photo[] }> = ({ photos }) => {
  const map = useMap();

  useEffect(() => {
    if (photos.length === 0) return;

    const bounds = L.latLngBounds([]);
    photos.forEach((photo) => {
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
  className = "",
}) => {
  const tileConfig = useMemo(() => getTileConfig(), []);

  // Filter photos that have location data
  const photosWithLocation = useMemo(
    () => photos.filter((photo) => hasLocation(photo)),
    [photos],
  );

  // Calculate center from photos or use default
  const mapCenter = useMemo((): [number, number] => {
    const defaultCenter: [number, number] = [37.7749, -122.4194];
    if (photosWithLocation.length === 0) return defaultCenter;

    if (photosWithLocation.length === 1) {
      const photo = photosWithLocation[0];
      return [photo.location_lat ?? 0, photo.location_lon ?? 0];
    }

    // Calculate average center
    const latSum = photosWithLocation.reduce(
      (sum, photo) => sum + (photo.location_lat ?? 0),
      0,
    );
    const lngSum = photosWithLocation.reduce(
      (sum, photo) => sum + (photo.location_lon ?? 0),
      0,
    );

    return [
      latSum / photosWithLocation.length,
      lngSum / photosWithLocation.length,
    ];
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
          <p className="text-sm">
            Upload photos with GPS coordinates to see them on the map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: `${height}px`, width: "100%" }}
        className="rounded-lg overflow-hidden"
      >
        <TileLayer
          url={tileConfig.url}
          tileSize={tileConfig.tileSize}
          zoomOffset={tileConfig.zoomOffset}
          attribution={tileConfig.attribution}
        />

        <MapBounds photos={photosWithLocation} />
        <ClusterLayer photos={photosWithLocation} onPhotoClick={onPhotoClick} />
        {photosWithLocation.map((photo) => {
          // Get thumbnail URL - using variants system or fallback
          const thumbnailUrl =
            photo.variants?.thumbnail?.url ??
            photo.original_url ??
            `/uploads/${photo.filename}`;

          return (
            <Marker
              key={photo.id}
              position={[photo.location_lat ?? 0, photo.location_lon ?? 0]}
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
                      alt={photo.title || "Photo"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h3 className="font-semibold text-sm mb-1 truncate">
                    {photo.title || "Untitled"}
                  </h3>
                  {photo.location_name && (
                    <p className="text-xs text-gray-600 mb-1">
                      📍 {photo.location_name}
                    </p>
                  )}
                  {photo.date_taken && (
                    <p className="text-xs text-gray-500">
                      📅 {formatDateSimple(photo.date_taken)}
                    </p>
                  )}
                  {(photo.camera_make ?? photo.camera_model) && (
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
        {photosWithLocation.length !== 1 ? "s" : ""} of {photos.length} total
      </div>
    </div>
  );
};

export default PhotoMap;
