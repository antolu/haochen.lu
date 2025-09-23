import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfilePictureUpload from '../ProfilePictureUpload';
import {
  useProfilePictures,
  useActiveProfilePicture,
  useUploadProfilePicture,
  useActivateProfilePicture,
  useDeleteProfilePicture,
} from '../../hooks/useProfilePictures';
import { selectOptimalImage, ImageUseCase } from '../../utils/imageUtils';
import type { ProfilePicture } from '../../types';

const ProfilePictureManager: React.FC = () => {
  const [showUpload, setShowUpload] = useState(false);

  // Query hooks
  const { data: profilePicturesData, isLoading, error } = useProfilePictures();
  const { data: activeData } = useActiveProfilePicture();

  // Mutation hooks
  const uploadMutation = useUploadProfilePicture();
  const activateMutation = useActivateProfilePicture();
  const deleteMutation = useDeleteProfilePicture();

  const profilePictures = profilePicturesData?.profile_pictures ?? [];
  const activeProfilePicture = activeData?.profile_picture;

  const handleUpload = async (file: File, title?: string) => {
    try {
      await uploadMutation.mutateAsync({ file, title });
      setShowUpload(false);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await activateMutation.mutateAsync(id);
    } catch (error) {
      console.error('Activation failed:', error);
    }
  };

  const handleDelete = async (profilePicture: ProfilePicture) => {
    const confirmMessage = `Are you sure you want to delete "${profilePicture.title ?? 'this profile picture'}"? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      await deleteMutation.mutateAsync(profilePicture.id);
    } catch (error) {
      console.error('Deletion failed:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (error) {
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
          Error loading profile pictures
        </div>
        <p className="text-gray-600">{error.message}</p>
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
            <h1 className="text-3xl font-bold text-gray-900">Profile Pictures</h1>
            <p className="mt-2 text-gray-600">
              Manage your profile pictures. Only one can be active at a time.
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload New Picture
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg
                className="w-6 h-6 text-blue-600"
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
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Pictures</p>
              <p className="text-2xl font-bold text-gray-900">{profilePictures.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Picture</p>
              <p className="text-2xl font-bold text-gray-900">{activeProfilePicture ? '1' : '0'}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg
                className="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2M7 4h10M7 4l-2 16h14l-2-16"
                />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatFileSize(
                  profilePictures.reduce((total, pic) => total + (pic.file_size ?? 0), 0)
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl"
            >
              <ProfilePictureUpload
                onUpload={handleUpload}
                onCancel={() => setShowUpload(false)}
                isUploading={uploadMutation.isPending}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Pictures Grid */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">All Profile Pictures</h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : profilePictures.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="h-12 w-12 mx-auto text-gray-400 mb-4"
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
              <p className="text-gray-600 mb-4">No profile pictures uploaded yet</p>
              <button
                onClick={() => setShowUpload(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Your First Picture
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {profilePictures.map(profilePicture => {
                const optimalImage = selectOptimalImage(profilePicture, ImageUseCase.THUMBNAIL);
                const isActive = profilePicture.id === activeProfilePicture?.id;

                return (
                  <div
                    key={profilePicture.id}
                    className={`relative bg-white rounded-lg border-2 overflow-hidden transition-colors ${
                      isActive ? 'border-green-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {/* Active Badge */}
                    {isActive && (
                      <div className="absolute top-2 left-2 z-10">
                        <span className="bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full">
                          Active
                        </span>
                      </div>
                    )}

                    {/* Image */}
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={optimalImage.url}
                        alt={profilePicture.title ?? 'Profile Picture'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 truncate">
                        {profilePicture.title ?? 'Untitled'}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {profilePicture.width}×{profilePicture.height} •{' '}
                        {formatFileSize(profilePicture.file_size ?? 0)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(profilePicture.created_at).toLocaleDateString()}
                      </p>

                      {/* Actions */}
                      <div className="flex space-x-2 mt-3">
                        {!isActive && (
                          <button
                            onClick={() => void handleActivate(profilePicture.id)}
                            disabled={activateMutation.isPending}
                            className="flex-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {activateMutation.isPending ? 'Setting...' : 'Set Active'}
                          </button>
                        )}
                        <button
                          onClick={() => void handleDelete(profilePicture)}
                          disabled={deleteMutation.isPending}
                          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureManager;
