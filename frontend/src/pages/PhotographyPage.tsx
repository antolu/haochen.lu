import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';

import { photos } from '../api/client';
import PhotoGrid from '../components/PhotoGrid';
import PhotoLightbox from '../components/PhotoLightbox';
import PhotoMap from '../components/PhotoMap';
import type { Photo, PhotoListResponse } from '../types';

const PhotographyPage: React.FC = () => {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPhotoSwipeOpen, setIsPhotoSwipeOpen] = useState(false);
  const [isLGOpening, setIsLGOpening] = useState(false);
  const [photoSwipeIndex, setPhotoSwipeIndex] = useState(0);
  const [highlightedPhotoId, setHighlightedPhotoId] = useState<string | null>(null);
  const photoGridRef = useRef<HTMLDivElement>(null);
  const photosPerPage = 24;
  const location = useLocation() as { state?: { photoId?: string } };

  // Fetch photos from API
  const {
    data: photoData,
    isLoading,
    error,
  } = useQuery<PhotoListResponse>({
    queryKey: ['photos', 'list', currentPage],
    queryFn: () =>
      photos.list({
        page: currentPage,
        per_page: photosPerPage,
        order_by: 'created_at',
      }),
  });

  // Handle new data
  useEffect(() => {
    if (photoData) {
      if (currentPage === 1) {
        setAllPhotos(photoData.photos);
      } else {
        setAllPhotos(prev => [...prev, ...photoData.photos]);
      }
      setIsLoadingMore(false);
    }
  }, [photoData, currentPage]);

  // If navigated with a specific photoId, open the lightbox at that index
  useEffect(() => {
    const targetId = location?.state?.photoId;
    if (!targetId || allPhotos.length === 0) return;
    const idx = allPhotos.findIndex(p => p.id === targetId);
    if (idx >= 0) {
      setPhotoSwipeIndex(idx);
      setIsLGOpening(true);
      setIsPhotoSwipeOpen(true);
    }
  }, [location?.state, allPhotos]);

  const handlePhotoClick = (_photo: Photo, index: number) => {
    setPhotoSwipeIndex(index);
    setIsLGOpening(true);
    setIsPhotoSwipeOpen(true);
  };

  const handleMapPhotoClick = (photo: Photo) => {
    const index = allPhotos.findIndex(p => p.id === photo.id);
    if (index >= 0) {
      // Highlight the photo in the grid
      setHighlightedPhotoId(photo.id);

      // Scroll to the photo in the grid
      if (photoGridRef.current) {
        // Calculate approximate position in grid
        const columns =
          window.innerWidth < 640
            ? 1
            : window.innerWidth < 1024
              ? 2
              : window.innerWidth < 1280
                ? 3
                : window.innerWidth < 1536
                  ? 4
                  : 5;
        const rowIndex = Math.floor(index / columns);
        const itemHeight = 300 + 8 + 32; // item height + gap + padding
        const scrollTop = rowIndex * itemHeight;

        photoGridRef.current.scrollTo({
          top: scrollTop,
          behavior: 'smooth',
        });
      }

      // Clear highlight after a delay
      setTimeout(() => {
        setHighlightedPhotoId(null);
      }, 3000);

      // Also open lightbox
      setPhotoSwipeIndex(index);
      setIsLGOpening(true);
      setIsPhotoSwipeOpen(true);
    }
  };

  const handlePhotoSwipeClose = () => {
    if (isLGOpening) {
      // Ignore close requests while opening to avoid destroy-loop
      return;
    }
    setIsPhotoSwipeOpen(false);
  };

  const handleLoadMore = () => {
    if (photoData && currentPage < photoData.pages) {
      setIsLoadingMore(true);
      setCurrentPage(prev => prev + 1);
    }
  };

  return (
    <div className="min-h-screen py-12">
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">
            Photography
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            A collection of my favorite captures from travels, adventures, and everyday moments
            around the world.
          </p>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="text-red-600">Failed to load photos. Please try again later.</p>
            </div>
          </motion.div>
        )}

        {/* Photo Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-12"
        >
          <PhotoGrid
            photos={allPhotos}
            isLoading={isLoading}
            onPhotoClick={handlePhotoClick}
            showMetadata={true}
            className="min-h-[600px]"
            ref={photoGridRef}
            highlightedPhotoId={highlightedPhotoId}
          />
        </motion.div>

        {/* Load More Button */}
        {photoData && currentPage < photoData.pages && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center"
          >
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center px-8 py-4 bg-primary-600 text-white text-lg font-medium rounded-lg hover:bg-primary-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? (
                <>
                  <svg className="animate-spin mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24">
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
          </motion.div>
        )}

        {/* Photo Count Info */}
        {photoData && allPhotos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center mt-8 text-gray-500 text-sm"
          >
            Showing {allPhotos.length} of {photoData.total} photos
          </motion.div>
        )}

        {/* Photo Map */}
        {allPhotos.length > 0 && (
          <motion.div
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
                Discover where these photos were captured. Click on markers to view photos from that
                location.
              </p>
            </div>
            <PhotoMap
              photos={allPhotos}
              onPhotoClick={handleMapPhotoClick}
              height={500}
              className="rounded-lg shadow-lg"
            />
          </motion.div>
        )}
      </div>

      {/* PhotoLightbox - Always mounted */}
      <PhotoLightbox
        photos={allPhotos}
        isOpen={isPhotoSwipeOpen}
        initialIndex={photoSwipeIndex}
        onClose={handlePhotoSwipeClose}
        onOpened={() => setIsLGOpening(false)}
        defaultShowInfo={!!location?.state?.photoId}
      />
    </div>
  );
};

export default PhotographyPage;
