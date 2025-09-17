import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import 'photoswipe/dist/photoswipe.css';

import { photos } from '../api/client';
import PhotoGrid from '../components/PhotoGrid';
import PhotoSwipeCustomUI from '../components/PhotoSwipeCustomUI';
import type { Photo, PhotoListResponse } from '../types';

const PhotographyPage: React.FC = () => {
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPhotoSwipeOpen, setIsPhotoSwipeOpen] = useState(false);
  const [photoSwipeIndex, setPhotoSwipeIndex] = useState(0);
  const photosPerPage = 24;

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

  const handlePhotoClick = (photo: Photo, index: number) => {
    setPhotoSwipeIndex(index);
    setIsPhotoSwipeOpen(true);
  };

  const handlePhotoSwipeClose = () => {
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
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
      </div>

      {/* PhotoSwipe Custom UI */}
      <PhotoSwipeCustomUI
        photos={allPhotos}
        isOpen={isPhotoSwipeOpen}
        initialIndex={photoSwipeIndex}
        onClose={handlePhotoSwipeClose}
      />
    </div>
  );
};

export default PhotographyPage;
