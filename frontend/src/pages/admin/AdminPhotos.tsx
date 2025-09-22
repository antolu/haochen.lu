import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// photoswipe not used in admin (editor replaces lightbox)

import PhotoUpload from '../../components/PhotoUpload';
import PhotoGrid from '../../components/PhotoGrid';
import PhotoListTable from '../../components/admin/PhotoListTable';
import PhotoEditorDrawer from '../../components/admin/PhotoEditorDrawer';
import PhotoForm from '../../components/admin/PhotoForm';
import {
  usePhotos,
  usePhotoStats,
  useDeletePhoto,
  useTogglePhotoFeatured,
} from '../../hooks/usePhotos';
import type { Photo } from '../../types';

const AdminPhotos: React.FC = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);

  // Query hooks
  const { data: photosData, isLoading: isLoadingPhotos, error: photosError } = usePhotos();
  const { data: statsData, isLoading: isLoadingStats } = usePhotoStats();

  // Mutation hooks
  const deleteMutation = useDeletePhoto();
  const toggleFeaturedMutation = useTogglePhotoFeatured();

  const photos = photosData?.photos ?? [];
  const stats = statsData ?? {
    total_photos: 0,
    featured_photos: 0,
    total_size: 0,
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
  };

  // PhotoSwipe disabled in admin; use editor instead

  const handlePhotoClick = (photo: Photo, _index: number) => {
    // Open full-page editor instead of lightbox in admin
    setEditingPhoto(photo);
  };

  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedPhotos.size} photo${selectedPhotos.size > 1 ? 's' : ''}? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    const photoIds = Array.from(selectedPhotos);
    for (const photoId of photoIds) {
      try {
        await deleteMutation.mutateAsync(photoId);
      } catch (error) {
        console.error(`Failed to delete photo ${photoId}:`, error);
      }
    }
    setSelectedPhotos(new Set());
  };

  const handleBulkToggleFeatured = async (featured: boolean) => {
    if (selectedPhotos.size === 0) return;

    const photoIds = Array.from(selectedPhotos);
    for (const photoId of photoIds) {
      try {
        await toggleFeaturedMutation.mutateAsync({ id: photoId, featured });
      } catch (error) {
        console.error(`Failed to update photo ${photoId}:`, error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (photosError) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg
            className="h-12 w-12 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          Error loading photos
        </div>
        <p className="text-gray-600">{photosError.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Photos</h1>
            <p className="mt-2 text-gray-600">Manage your photo collection</p>
          </div>
          <div className="flex space-x-3">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setShowUpload(true)}
              disabled={showUpload}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <span className="flex items-center">
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Upload Photos
              </span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {!isLoadingStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
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
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Total Photos</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.total_photos || photos.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-yellow-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Featured</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.featured_photos || photos.filter(p => p.featured).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 010 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 010-2h4zM6 6v12h12V6H6zm3-2V3h6v1H9z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Storage Used</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatFileSize(
                      stats.total_size || photos.reduce((sum, p) => sum + (p.file_size || 0), 0)
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Selected</p>
                  <p className="text-2xl font-bold text-purple-600">{selectedPhotos.size}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPhotos.size > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              {selectedPhotos.size} photo{selectedPhotos.size > 1 ? 's' : ''} selected
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  void handleBulkToggleFeatured(true);
                }}
                className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded border border-yellow-300 transition-colors"
              >
                ⭐ Feature
              </button>
              <button
                onClick={() => {
                  void handleBulkToggleFeatured(false);
                }}
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
              >
                Remove Feature
              </button>
              <button
                onClick={() => {
                  void handleBulkDelete();
                }}
                className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded border border-red-300 transition-colors"
              >
                🗑 Delete
              </button>
              <button
                onClick={() => setSelectedPhotos(new Set())}
                className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            onClick={e => {
              if (e.target === e.currentTarget) {
                setShowUpload(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Upload Photos</h2>
                  <button
                    onClick={() => setShowUpload(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <PhotoUpload
                  onComplete={handleUploadComplete}
                  onCancel={() => setShowUpload(false)}
                  maxFiles={20}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Photos Display */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">All Photos ({photos.length})</h2>

          {photos.length > 0 && !editingPhoto && (
            <button
              onClick={() => handleSelectAll()}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {viewMode === 'grid' ? (
          editingPhoto ? (
            <PhotoForm
              photo={editingPhoto}
              onCancel={() => setEditingPhoto(null)}
              onSuccess={() => setEditingPhoto(null)}
            />
          ) : (
            <div className="min-h-[600px]">
              <PhotoGrid
                photos={photos}
                isLoading={isLoadingPhotos}
                onPhotoClick={handlePhotoClick}
                showMetadata={true}
                className="h-[600px]"
              />
            </div>
          )
        ) : (
          <PhotoListTable photos={photos} isLoading={isLoadingPhotos} onEdit={setEditingPhoto} />
        )}
      </div>
      {/* Drawer for list view edits */}
      <AnimatePresence>
        {viewMode === 'list' && editingPhoto && (
          <PhotoEditorDrawer photo={editingPhoto} onClose={() => setEditingPhoto(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPhotos;
