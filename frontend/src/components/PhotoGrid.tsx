import React, { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInView } from 'react-intersection-observer';
import { motion } from 'framer-motion';
import MiniMap from './MiniMap';
import type { Photo } from '../types';

interface PhotoGridProps {
  photos: Photo[];
  isLoading?: boolean;
  onPhotoClick?: (photo: Photo, index: number) => void;
  columns?: number;
  gap?: number;
  showMetadata?: boolean;
  className?: string;
}

interface PhotoCardProps {
  photo: Photo;
  index: number;
  onClick?: (photo: Photo, index: number) => void;
  showMetadata?: boolean;
  width: number;
  height: number;
}

const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  index,
  onClick,
  showMetadata = false,
  width,
  height,
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
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick(photo, index);
    }
  };

  // Determine image source - prefer small variant for better quality, fallback to thumbnail, then original
  const imageUrl =
    photo.variants?.small?.path || photo.variants?.medium?.path || photo.original_path;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      className={`
        group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer
        transform transition-all duration-300 hover:scale-105 md:hover:scale-110
        ${onClick ? 'hover:shadow-xl' : ''}
      `}
      style={{
        width,
        height,
        zIndex: 1, // Base z-index for all photos
      }}
      onMouseEnter={e => {
        // Ensure hovered element is always on top
        (e.currentTarget as HTMLElement).style.zIndex = '100';
      }}
      onMouseLeave={e => {
        // Reset z-index when not hovered
        (e.currentTarget as HTMLElement).style.zIndex = '1';
      }}
      onClick={handleClick}
    >
      {/* Loading Skeleton */}
      {!isLoaded && !hasError && inView && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Image */}
      {inView && !hasError && (
        <>
          <img
            src={imageUrl}
            alt={photo.title || 'Photo'}
            className={`
              w-full h-full object-cover transition-opacity duration-300
              ${isLoaded ? 'opacity-100' : 'opacity-0'}
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

          {/* Mini Map for Geotagged Photos */}
          {photo.location_lat && photo.location_lon && (
            <div className="absolute top-2 left-2">
              <MiniMap
                latitude={photo.location_lat}
                longitude={photo.location_lon}
                size={60}
                zoom={11}
                className="shadow-lg"
                onClick={() => {
                  // Could open full map view
                }}
              />
            </div>
          )}

          {/* Simplified Metadata Overlay */}
          {showMetadata && isLoaded && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <h3 className="font-medium text-sm truncate mb-1">{photo.title || 'Untitled'}</h3>

                {photo.location_name && (
                  <p className="text-xs text-gray-300 truncate mb-1">📍 {photo.location_name}</p>
                )}

                {photo.date_taken && (
                  <p className="text-xs text-gray-400 truncate">
                    📅 {new Date(photo.date_taken).toLocaleDateString()}
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
    </motion.div>
  );
};

const PhotoGrid: React.FC<PhotoGridProps> = ({
  photos,
  isLoading = false,
  onPhotoClick,
  columns,
  gap = 8,
  showMetadata = false,
  className = '',
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // Auto-calculate columns based on container width - reduced for larger square photos
  const getColumns = () => {
    if (columns) return columns;
    if (containerWidth < 640) return 1; // sm - single column on mobile
    if (containerWidth < 1024) return 2; // md - two columns on tablet
    if (containerWidth < 1536) return 2; // lg/xl - two columns on desktop
    return 3; // 2xl - three columns on very large screens
  };

  const numColumns = getColumns();
  const itemWidth = Math.max(
    300, // Reduced from 400px to 300px
    Math.floor((containerWidth - gap * (numColumns - 1)) / numColumns)
  );
  const itemHeight = itemWidth; // 1:1 aspect ratio (square)

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (parentRef.current) {
        setContainerWidth(parentRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate rows for virtualization - add extra height for hover effects
  const rowCount = Math.ceil(photos.length / numColumns);
  const rowHeight = itemHeight + gap + 32; // Extra 32px for padding and hover effects

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-200 rounded-lg animate-pulse" />
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
        <p className="text-gray-500 text-sm mt-1">Upload some photos to see them here</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={`h-full overflow-auto ${className}`}
      style={{ height: '100%', width: '100%', padding: '24px' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const startIndex = virtualRow.index * numColumns;
          const endIndex = Math.min(startIndex + numColumns, photos.length);
          const rowPhotos = photos.slice(startIndex, endIndex);

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex overflow-visible" style={{ gap: `${gap}px`, padding: '16px' }}>
                {rowPhotos.map((photo, colIndex) => {
                  const photoIndex = startIndex + colIndex;

                  return (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      index={photoIndex}
                      onClick={onPhotoClick}
                      showMetadata={showMetadata}
                      width={itemWidth}
                      height={itemHeight}
                    />
                  );
                })}
                {/* Fill remaining columns if the last row is incomplete */}
                {rowPhotos.length < numColumns &&
                  Array.from({ length: numColumns - rowPhotos.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ width: itemWidth, height: itemHeight }} />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PhotoGrid;
