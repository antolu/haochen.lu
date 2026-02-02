import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion as m } from "framer-motion";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import PhotoGrid from "../components/PhotoGrid";
import PhotoLightbox from "../components/PhotoLightbox";
import MapLibrePhotoMap from "../components/MapLibrePhotoMap";
import { useOptimizedPhotos } from "../hooks/usePhotos";
import { useIsTransitioning } from "../stores/photoCache";
import { monitorCachePerformance } from "../utils/optimizationTest";
import type { Photo } from "../types";
import OrderBySelector, {
  type OrderByOption,
} from "../components/OrderBySelector";

const PhotographyPage: React.FC = () => {
  const [triggerGallery, setTriggerGallery] = useState<{
    index: number;
  } | null>(null);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(
    null,
  );
  const photoGridRef = useRef<HTMLDivElement>(null);
  const location = useLocation() as { state?: { photoId?: string } };
  const [searchParams, setSearchParams] = useSearchParams();

  const orderBy = useMemo<OrderByOption>(() => {
    const param = searchParams.get("order_by");
    if (param === "created_at" || param === "date_taken" || param === "order") {
      return param as OrderByOption;
    }
    // Default to manual order when no param
    return "order";
  }, [searchParams]);

  // Use optimized photos hook with caching
  const {
    photos: allPhotos,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    handleOrderSwitch,
    total,
  } = useOptimizedPhotos(orderBy);

  const isTransitioning = useIsTransitioning();

  // Initialize performance monitoring in development
  useEffect(() => {
    monitorCachePerformance();
  }, []);

  // If navigated with a specific photoId, open the lightbox at that index
  useEffect(() => {
    const targetId = location?.state?.photoId;
    if (!targetId || allPhotos.length === 0) return;
    const idx = allPhotos.findIndex((p) => p.id === targetId);
    if (idx >= 0) {
      setTriggerGallery({ index: idx });
    }
  }, [location?.state, allPhotos]);

  const handlePhotoClick = useCallback((_photo: Photo, index: number) => {
    setTriggerGallery({ index });
  }, []);

  const handleMapPhotoClick = useCallback(
    (photo: Photo) => {
      const index = allPhotos.findIndex((p) => p.id === photo.id);
      if (index >= 0) {
        // Highlight the photo in the grid
        setHighlightedPhotoId(photo.id);

        // Scroll to the photo in the grid using refs instead of testids
        if (photoGridRef.current) {
          // Find all photo card elements - they use the photo-card class
          const photoCards =
            photoGridRef.current.querySelectorAll(".photo-card");
          const photoElement = photoCards[index];

          if (photoElement) {
            photoElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "nearest",
            });
          }
        }

        // Clear highlight after a delay
        setTimeout(() => {
          setHighlightedPhotoId(null);
        }, 3000);
      }
    },
    [allPhotos],
  );

  const handleOrderChange = (value: OrderByOption) => {
    // Update URL parameters
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params);
        if (value === "order") {
          next.delete("order_by");
        } else {
          next.set("order_by", value);
        }
        return next;
      },
      { replace: true },
    );

    // The optimized hook will handle the smart caching automatically
    handleOrderSwitch(value);
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  };

  return (
    <div className="min-h-screen py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Lightweight nav back to home */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
            aria-label="Back to home"
          >
            <span className="mr-1">←</span> Back to Home
          </Link>
        </div>

        {/* Header Section */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">
            Photography
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            A collection of my favorite captures from travels, adventures, and
            everyday moments around the world.
          </p>
        </m.div>

        {/* Error State */}
        {error && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-600">
                Failed to load photos. Please try again later.
              </p>
            </div>
          </m.div>
        )}

        {/* Photo Grid */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex justify-end mb-6">
            <OrderBySelector value={orderBy} onChange={handleOrderChange} />
          </div>
          <PhotoGrid
            photos={allPhotos}
            isLoading={isLoading}
            isTransitioning={isTransitioning}
            onPhotoClick={handlePhotoClick}
            showMetadata={true}
            className="min-h-[600px]"
            ref={photoGridRef}
            highlightedPhotoId={highlightedPhotoId}
          />
        </m.div>

        {/* Load More Button */}
        {hasMore && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center mt-4"
          >
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center px-8 py-4 bg-primary text-primary-foreground text-lg font-medium rounded-lg hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <svg
                    className="animate-spin mr-2 h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V 0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </>
              ) : (
                <>
                  Load More Photos
                  <svg
                    className="ml-2 w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </>
              )}
            </button>
          </m.div>
        )}

        {/* Photo Count Info */}
        {allPhotos.length > 0 && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 text-gray-500 text-sm"
          >
            Showing {allPhotos.length} of {total} photos
            {isTransitioning && (
              <span className="ml-2 text-blue-500">(transitioning...)</span>
            )}
          </m.div>
        )}

        {/* Photo Map */}
        {allPhotos.length > 0 && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="mt-16"
          >
            <div className="text-center mb-8">
              <h2 className="text-3xl font-serif font-bold text-gray-900 mb-4">
                Explore by Location
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Discover where these photos were captured. Click on markers to
                view photos from that location.
              </p>
            </div>
            <MapLibrePhotoMap
              photos={allPhotos}
              onPhotoClick={handleMapPhotoClick}
              height={650}
              className="rounded-lg shadow-lg"
            />
          </m.div>
        )}
      </div>

      {triggerGallery && (
        <PhotoLightbox
          photos={allPhotos}
          initialIndex={triggerGallery.index}
          defaultShowInfo={!!location?.state?.photoId}
          onClose={() => setTriggerGallery(null)}
        />
      )}
    </div>
  );
};

export default PhotographyPage;
