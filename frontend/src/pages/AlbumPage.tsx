import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { photos } from '../api/client';
import type { Photo } from '../types';

const AlbumPage: React.FC = () => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  
  const { data: allPhotos, isLoading } = useQuery({
    queryKey: ['photos', 'all'],
    queryFn: () => photos.list({ page: 1, per_page: 100 }),
  });

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedPhoto(null);
      }
    };

    if (selectedPhoto) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [selectedPhoto]);

  const openPhoto = (photo: Photo) => {
    setSelectedPhoto(photo);
  };

  const closePhoto = () => {
    setSelectedPhoto(null);
  };

  const goToPrevious = () => {
    if (!selectedPhoto || !allPhotos?.photos) return;
    const currentIndex = allPhotos.photos.findIndex(p => p.id === selectedPhoto.id);
    const previousIndex = currentIndex > 0 ? currentIndex - 1 : allPhotos.photos.length - 1;
    setSelectedPhoto(allPhotos.photos[previousIndex]);
  };

  const goToNext = () => {
    if (!selectedPhoto || !allPhotos?.photos) return;
    const currentIndex = allPhotos.photos.findIndex(p => p.id === selectedPhoto.id);
    const nextIndex = currentIndex < allPhotos.photos.length - 1 ? currentIndex + 1 : 0;
    setSelectedPhoto(allPhotos.photos[nextIndex]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black w-full m-0 p-0">
      {/* Minimal Navigation Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
          <div className="text-white text-sm font-light">
            {allPhotos?.photos ? `${allPhotos.photos.length} Photos` : 'Album'}
          </div>
        </div>
      </header>

      {/* Seamless Photo Grid */}
      <div className="album-grid pt-16">
        {allPhotos?.photos && allPhotos.photos.map((photo, index) => (
          <motion.div
            key={photo.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: index * 0.02 }}
            className="album-photo cursor-pointer"
            onClick={() => openPhoto(photo)}
          >
            <img
              src={`/${photo.webp_path}`}
              alt={photo.title}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity duration-200"
              loading="lazy"
            />
          </motion.div>
        ))}
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
          onClick={closePhoto}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={closePhoto}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Navigation buttons */}
            <button
              onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); goToNext(); }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 bg-black/50 rounded-full p-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Main photo */}
            <img
              src={`/${selectedPhoto.original_path || selectedPhoto.webp_path}`}
              alt={selectedPhoto.title}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Photo info panel */}
            <div 
              className="absolute bottom-4 left-4 right-4 bg-black/80 text-white p-4 rounded-lg backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p className="text-sm text-gray-300 mb-3">{selectedPhoto.description}</p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400">
                <div>
                  {selectedPhoto.camera_make && selectedPhoto.camera_model && (
                    <p><span className="text-gray-300">Camera:</span> {selectedPhoto.camera_make} {selectedPhoto.camera_model}</p>
                  )}
                  {selectedPhoto.lens && (
                    <p><span className="text-gray-300">Lens:</span> {selectedPhoto.lens}</p>
                  )}
                  {selectedPhoto.focal_length && (
                    <p><span className="text-gray-300">Focal Length:</span> {selectedPhoto.focal_length}mm</p>
                  )}
                </div>
                <div>
                  {selectedPhoto.aperture && (
                    <p><span className="text-gray-300">Aperture:</span> f/{selectedPhoto.aperture}</p>
                  )}
                  {selectedPhoto.shutter_speed && (
                    <p><span className="text-gray-300">Shutter:</span> {selectedPhoto.shutter_speed}s</p>
                  )}
                  {selectedPhoto.iso && (
                    <p><span className="text-gray-300">ISO:</span> {selectedPhoto.iso}</p>
                  )}
                  {selectedPhoto.date_taken && (
                    <p><span className="text-gray-300">Date:</span> {new Date(selectedPhoto.date_taken).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumPage;