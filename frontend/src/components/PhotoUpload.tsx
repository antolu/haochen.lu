import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useUploadPhoto } from '../hooks/usePhotos';

interface PhotoUploadProps {
  onComplete?: () => void;
  onCancel?: () => void;
  maxFiles?: number;
}

interface UploadFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

interface PhotoMetadata {
  title: string;
  description: string;
  category: string;
  tags: string;
  featured: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onComplete,
  onCancel,
  maxFiles = 10,
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);
  const uploadMutation = useUploadPhoto();

  const { register, handleSubmit } = useForm<PhotoMetadata>({
    defaultValues: {
      title: '',
      description: '',
      category: '',
      tags: '',
      featured: false,
    },
  });

  // Handle file drops
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.slice(0, maxFiles - uploadFiles.length).map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      return {
        id,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending' as const,
      };
    });

    setUploadFiles((prev) => [...prev, ...newFiles]);
  }, [uploadFiles.length, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true,
    disabled: uploadFiles.length >= maxFiles,
  });

  // Remove file from upload queue
  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => {
      const updated = prev.filter((f) => f.id !== fileId);
      // Cleanup preview URL
      const fileToRemove = prev.find((f) => f.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return updated;
    });
  };

  // Upload single file
  const uploadSingleFile = async (uploadFile: UploadFile, metadata: PhotoMetadata) => {
    setCurrentUpload(uploadFile.id);
    
    // Update file status
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f))
    );

    try {
      const title = metadata.title || uploadFile.file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      
      await uploadMutation.mutateAsync({
        file: uploadFile.file,
        metadata: {
          title,
          description: metadata.description,
          category: metadata.category,
          tags: metadata.tags,
          featured: metadata.featured,
        },
      });

      // Update file status to completed
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === uploadFile.id ? { ...f, status: 'completed' as const, progress: 100 } : f))
      );
    } catch (error) {
      // Update file status to error
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error' as const,
                progress: 0,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );
    } finally {
      setCurrentUpload(null);
    }
  };

  // Upload all files
  const uploadAllFiles = async (metadata: PhotoMetadata) => {
    const pendingFiles = uploadFiles.filter((f) => f.status === 'pending' || f.status === 'error');
    
    for (const uploadFile of pendingFiles) {
      await uploadSingleFile(uploadFile, metadata);
    }

    // Check if all uploads completed successfully
    const allCompleted = uploadFiles.every((f) => f.status === 'completed');
    if (allCompleted && onComplete) {
      setTimeout(onComplete, 500); // Small delay to show completion
    }
  };

  const onSubmit = (data: PhotoMetadata) => {
    uploadAllFiles(data);
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      uploadFiles.forEach((file) => {
        URL.revokeObjectURL(file.preview);
      });
    };
  }, []);

  const pendingCount = uploadFiles.filter((f) => f.status === 'pending').length;
  const completedCount = uploadFiles.filter((f) => f.status === 'completed').length;
  const errorCount = uploadFiles.filter((f) => f.status === 'error').length;
  const isUploading = currentUpload !== null;

  return (
    <div className="space-y-6">
      {/* File Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploadFiles.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-4">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop photos here...' : 'Upload photos'}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {uploadFiles.length >= maxFiles
                ? `Maximum ${maxFiles} files reached`
                : `Drag and drop photos here, or click to browse (${uploadFiles.length}/${maxFiles})`}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports: JPG, PNG, WebP, HEIC • Max size: 50MB per file
            </p>
          </div>
        </div>
      </div>

      {/* Upload Queue */}
      <AnimatePresence>
        {uploadFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Upload Progress Summary */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">
                {completedCount > 0 && (
                  <span className="text-green-600 font-medium">{completedCount} completed</span>
                )}
                {pendingCount > 0 && (
                  <span className="text-blue-600 font-medium ml-2">{pendingCount} pending</span>
                )}
                {errorCount > 0 && (
                  <span className="text-red-600 font-medium ml-2">{errorCount} failed</span>
                )}
              </div>
              {isUploading && (
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </div>
              )}
            </div>

            {/* File List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadFiles.map((file) => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-white border rounded-lg p-3 space-y-2"
                >
                  {/* File Preview */}
                  <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
                    <img
                      src={file.preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    {file.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                    {file.status === 'completed' && (
                      <div className="absolute top-2 right-2">
                        <svg className="h-6 w-6 text-green-500 bg-white rounded-full p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="absolute top-2 right-2">
                        <svg className="h-6 w-6 text-red-500 bg-white rounded-full p-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                    {file.error && (
                      <p className="text-xs text-red-600">{file.error}</p>
                    )}
                  </div>

                  {/* Remove Button */}
                  {file.status !== 'uploading' && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs transition-colors"
                    >
                      ×
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Metadata Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-medium text-gray-900">Photo Details (Applied to All)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title Template
                  </label>
                  <input
                    {...register('title')}
                    type="text"
                    placeholder="Leave empty to use filename"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    {...register('category')}
                    type="text"
                    placeholder="e.g., Portrait, Landscape, Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Describe these photos..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  {...register('tags')}
                  type="text"
                  placeholder="e.g., outdoor, nature, sunset (comma-separated)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  {...register('featured')}
                  type="checkbox"
                  id="featured"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="featured" className="ml-2 text-sm text-gray-700">
                  Mark as featured (will appear on homepage)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isUploading}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={pendingCount === 0 || isUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Uploading {pendingCount} photos...
                    </>
                  ) : (
                    <>Upload {pendingCount} photos</>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PhotoUpload;