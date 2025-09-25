import React, { useRef, useState, memo, forwardRef } from "react";
import { useInView } from "react-intersection-observer";
import type { Photo } from "../types";
import { formatDateSimple } from "../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";
import "./PhotoGrid.css";

interface PhotoGridProps {
  photos: Photo[];
  isLoading?: boolean;
  onPhotoClick?: (photo: Photo, index: number) => void;
  showMetadata?: boolean;
  className?: string;
  highlightedPhotoId?: string | null;
}

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, index: number) => void;
  showMetadata?: boolean;
  isHighlighted?: boolean;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  index,
  onClick,
  showMetadata = false,
  isHighlighted = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true,
  });

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only prevent default if we have a click handler to avoid breaking accessibility
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(photo, index);
    }
  };

  // Use DPI-aware image selection for optimal quality based on device and viewport
  const optimalImage = selectOptimalImage(photo, ImageUseCase.GALLERY, {
    width: 400, // Standard grid item size
    height: 400,
  });
  const imageUrl = optimalImage.url;
  const srcSet = optimalImage.srcset;
  const sizes = optimalImage.sizes;

  return (
    <div
      ref={ref}
      data-testid={`photo-card-${index + 1}`}
      className={`
        photo-card group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer
        transform transition-all duration-300 hover:scale-105 md:hover:scale-110
        ${onClick ? "hover:shadow-xl" : ""}
        ${isHighlighted ? "ring-4 ring-blue-500 ring-opacity-75 shadow-2xl scale-105" : ""}
        opacity-0 animate-fade-in
      `}
      style={{
        zIndex: isHighlighted ? 50 : 1,
        animationDelay: `${index * 20}ms`,
      }}
      onMouseEnter={(e) => {
        // Ensure hovered element is always on top
        (e.currentTarget as HTMLElement).style.zIndex = "100";
      }}
      onMouseLeave={(e) => {
        // Reset z-index when not hovered
        (e.currentTarget as HTMLElement).style.zIndex = isHighlighted
          ? "50"
          : "1";
      }}
      onClick={handleClick}
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && inView && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          data-testid="loading-skeleton"
        />
      )}

      {/* Image */}
      {inView && !hasError && (
        <>
          <img
            src={imageUrl}
            srcSet={srcSet}
            sizes={sizes}
            alt={photo.title || "Photo"}
            className={`
              w-full h-full object-cover transition-opacity duration-300
              ${isLoaded ? "opacity-100" : "opacity-0"}
            `}
            onLoad={handleImageLoad}
            onError={handleImageError}
            loading="lazy"
          />

          {/* Semi-transparent overlay that fades on hover */}
          <div className="absolute inset-0 bg-black/25 group-hover:bg-transparent transition-all duration-300" />

          {/* Featured Badge */}
          {photo.featured && (
            <div className="absolute top-2 right-2">
              <svg
                className="h-5 w-5 text-yellow-500 drop-shadow-lg"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          )}

          {/* Simplified Metadata Overlay */}
          {showMetadata && isLoaded && (
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              data-testid="metadata-overlay"
            >
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <h3 className="font-medium text-sm truncate mb-1">
                  {photo.title || "Untitled"}
                </h3>

                {photo.location_name && (
                  <p
                    className="text-xs text-gray-300 truncate mb-1"
                    data-testid="location-text"
                  >
                    📍 {photo.location_name}
                  </p>
                )}

                {photo.date_taken && (
                  <p className="text-xs text-gray-400 truncate">
                    📅 {formatDateSimple(photo.date_taken)}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg
              className="h-8 w-8 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <p className="text-xs">Failed to load</p>
          </div>
        </div>
      )}
    </div>
  );
};

const PhotoGrid = memo(
  forwardRef<HTMLDivElement, PhotoGridProps>(
    (
      {
        photos,
        isLoading = false,
        onPhotoClick,
        showMetadata = false,
        className = "",
        highlightedPhotoId = null,
      },
      ref,
    ) => {
      const parentRef = useRef<HTMLDivElement>(null);
      const containerRef =
        (ref as React.RefObject<HTMLDivElement>) || parentRef;

      // Loading skeleton
      if (isLoading) {
        return (
          <div
            className={`photo-grid-container ${className}`}
            data-testid="loading-grid"
            ref={containerRef}
          >
            <div className="loading-grid">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  data-testid="skeleton-item"
                  className="skeleton-item"
                />
              ))}
            </div>
          </div>
        );
      }

      // Empty state
      if (!photos.length) {
        return (
          <div className={`text-center py-12 ${className}`}>
            <svg
              className="h-12 w-12 mx-auto text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-600 text-lg font-medium">No photos found</p>
            <p className="text-gray-500 text-sm mt-1">
              Upload some photos to see them here
            </p>
          </div>
        );
      }

      return (
        <div
          ref={containerRef}
          data-testid="photo-grid-container"
          className={`photo-grid-container ${className}`}
        >
          <div className="photo-grid">
            {photos.map((photo, index) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={index}
                onClick={onPhotoClick}
                showMetadata={showMetadata}
                isHighlighted={highlightedPhotoId === photo.id}
              />
            ))}
          </div>
        </div>
      );
    },
  ),
);

PhotoGrid.displayName = "PhotoGrid";

export default PhotoGrid;
