import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import type { AxiosError } from 'axios';
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
  comments?: string; // Optional since we don't have a UI field for this yet
  featured: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({ onComplete, onCancel, maxFiles = 10 }) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [currentUpload, setCurrentUpload] = useState<string | null>(null);
  const uploadMutation = useUploadPhoto();

  const { register, handleSubmit } = useForm<PhotoMetadata>({
    defaultValues: {
      title: '',
      description: '',
      category: '',
      tags: '',
      comments: '',
      featured: false,
    },
    mode: 'onBlur', // Validate on blur for better UX
  });

  // Watch for upload completion and call onComplete when all files are done
  useEffect(() => {
    if (uploadFiles.length === 0) return; // No files to check

    const allCompleted = uploadFiles.every(f => f.status === 'completed');
    const hasErrors = uploadFiles.some(f => f.status === 'error');
    const hasUploading = uploadFiles.some(f => f.status === 'uploading');

    // Only trigger completion if we have files, all are completed, and none are currently uploading
    if (allCompleted && !hasErrors && !hasUploading && onComplete) {
      // All uploads completed successfully - closing dialog
      setTimeout(onComplete, 500); // Small delay to show completion state
    }
  }, [uploadFiles, onComplete]);

  // Handle file drops
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      try {
        if (!acceptedFiles || acceptedFiles.length === 0) {
          // No files provided to onDrop
          return;
        }

        // Validate each file before processing
        const validFiles = acceptedFiles.filter(file => {
          if (!(file instanceof File)) {
            console.warn('Invalid file object received:', file);
            return false;
          }

          if (!file.name) {
            console.warn('File missing name property:', file);
            return false;
          }

          if (file.size === 0) {
            console.warn('Empty file received:', file.name);
            return false;
          }

          if (file.size > 50 * 1024 * 1024) {
            // 50MB limit
            console.warn('File too large:', file.name, file.size);
            return false;
          }

          return true;
        });

        if (validFiles.length === 0) {
          console.warn('No valid files to process');
          return;
        }

        const availableSlots = maxFiles - uploadFiles.length;
        const filesToProcess = validFiles.slice(0, availableSlots);

        if (filesToProcess.length < validFiles.length) {
          console.warn(
            `Only processing ${filesToProcess.length} of ${validFiles.length} files due to upload limit`
          );
        }

        const newFiles: UploadFile[] = filesToProcess.map(file => {
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          let preview = '';

          try {
            preview = URL.createObjectURL(file);
          } catch (error) {
            console.warn('Failed to create preview URL for file:', file.name, error);
            preview = ''; // Fallback to empty preview
          }

          return {
            id,
            file,
            preview,
            progress: 0,
            status: 'pending' as const,
          };
        });

        // Added files to upload queue
        setUploadFiles(prev => [...prev, ...newFiles]);
      } catch (error) {
        console.error('Error processing dropped files:', error);
      }
    },
    [uploadFiles.length, maxFiles]
  );

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
    if (!fileId) {
      console.warn('removeFile called with empty fileId');
      return;
    }

    setUploadFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);

      if (!fileToRemove) {
        console.warn('File not found for removal:', fileId);
        return prev; // No change if file not found
      }

      // Safely cleanup preview URL
      try {
        if (fileToRemove.preview) {
          URL.revokeObjectURL(fileToRemove.preview);
        }
      } catch (error) {
        console.warn('Failed to revoke object URL:', error);
      }

      const updated = prev.filter(f => f.id !== fileId);
      // Removed file from upload queue
      return updated;
    });
  };

  // Upload single file
  const uploadSingleFile = async (uploadFile: UploadFile, metadata: PhotoMetadata) => {
    // Comprehensive validation of uploadFile
    if (!uploadFile) {
      console.error('uploadSingleFile called with undefined uploadFile');
      throw new Error('Upload file is undefined');
    }

    if (!uploadFile.id) {
      console.error('uploadSingleFile called with uploadFile missing id:', uploadFile);
      throw new Error('Upload file missing required id');
    }

    if (!uploadFile.file) {
      console.error('uploadSingleFile called with uploadFile missing file property:', uploadFile);
      throw new Error('Upload file missing required file property');
    }

    if (!(uploadFile.file instanceof File)) {
      console.error('uploadSingleFile called with invalid file object:', uploadFile.file);
      throw new Error('Upload file.file is not a valid File object');
    }

    // Starting upload for file

    setCurrentUpload(uploadFile.id);

    // Update file status
    setUploadFiles(prev =>
      prev.map(f =>
        f.id === uploadFile.id ? { ...f, status: 'uploading' as const, progress: 0 } : f
      )
    );

    try {
      // Ensure metadata has safe defaults
      const safeMetadata = {
        title: metadata?.title || '',
        description: metadata?.description || '',
        category: metadata?.category || '',
        tags: metadata?.tags || '',
        featured: metadata?.featured || false,
      };

      // Safe file name access with fallback and defensive programming
      const fileName = uploadFile.file?.name || 'untitled-file';
      const title =
        safeMetadata.title ||
        (fileName && typeof fileName === 'string' ? fileName.replace(/\.[^/.]+$/, '') : 'untitled');

      const uploadData = {
        file: uploadFile.file,
        metadata: {
          title,
          description: safeMetadata.description,
          category: safeMetadata.category,
          tags: safeMetadata.tags,
          comments: '',
          featured: safeMetadata.featured,
        },
      };

      // Uploading photo with data

      await uploadMutation.mutateAsync(uploadData);

      // Update file status to completed
      setUploadFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id ? { ...f, status: 'completed' as const, progress: 100 } : f
        )
      );
    } catch (error) {
      console.error('Upload failed for file:', uploadFile.file?.name || 'unknown', error);

      // Categorize and extract detailed error message
      let errorMessage = 'Upload failed';
      let errorCategory = 'unknown';

      if (error instanceof Error) {
        errorMessage = error.message;
        errorCategory = 'client-error';
      }

      // Handle network/HTTP errors
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const axiosError = error as AxiosError<{ detail?: string }>;

        if (axiosError.response) {
          const status = axiosError.response.status;
          const detail = axiosError.response.data?.detail;

          // Categorize by HTTP status
          if (status === 422) {
            errorCategory = 'validation';
            errorMessage = detail ?? 'File validation failed. Please check file type and size.';
          } else if (status === 413) {
            errorCategory = 'file-too-large';
            errorMessage = 'File is too large. Maximum size is 50MB.';
          } else if (status === 401 || status === 403) {
            errorCategory = 'authorization';
            errorMessage = 'Not authorized to upload files. Please log in again.';
          } else if (status === 500) {
            errorCategory = 'server-error';
            errorMessage = 'Server error occurred. Please try again later.';
          } else {
            errorCategory = 'http-error';
            errorMessage =
              detail ?? `HTTP ${status}: ${axiosError.response.statusText ?? 'Unknown error'}`;
          }

          console.warn('Upload HTTP error details:', {
            status,
            statusText: axiosError.response.statusText,
            detail,
            headers: axiosError.response.headers,
          });
        } else if (axiosError.request) {
          errorCategory = 'network';
          errorMessage = 'Network error. Please check your connection and try again.';
          console.warn('Upload network error:', axiosError.request);
        }
      }

      console.warn('Upload error summary:', {
        fileName: uploadFile.file?.name ?? 'unknown',
        fileSize: uploadFile.file?.size ?? 0,
        category: errorCategory,
        message: errorMessage,
      });

      // Update file status to error
      setUploadFiles(prev =>
        prev.map(f =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error' as const,
                progress: 0,
                error: errorMessage,
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
    const pendingFiles = uploadFiles.filter(f => {
      // Only include files with valid structure
      const isValidStatus = f.status === 'pending' || f.status === 'error';
      const hasValidFile = f?.file instanceof File;

      if (isValidStatus && !hasValidFile) {
        console.warn('Skipping invalid file in upload queue:', f);
        // Mark as error so it doesn't stay pending forever
        setUploadFiles(prev =>
          prev.map(file =>
            file.id === f.id
              ? {
                  ...file,
                  status: 'error' as const,
                  error: 'Invalid file object',
                }
              : file
          )
        );
      }

      return isValidStatus && hasValidFile;
    });

    // Starting batch upload

    for (const uploadFile of pendingFiles) {
      try {
        await uploadSingleFile(uploadFile, metadata);
      } catch (error) {
        console.error(`Failed to upload file ${uploadFile.id}:`, error);
        // Individual file errors are handled in uploadSingleFile
        // Continue with other files
      }
    }

    // Batch upload process completed
    // Note: Completion check is now handled by useEffect watching uploadFiles state
  };

  const onSubmit = (data: PhotoMetadata) => {
    // Comprehensive form data validation and sanitization
    const safeData: PhotoMetadata = {
      title: (data?.title || '').trim(),
      description: (data?.description || '').trim(),
      category: (data?.category || '').trim(),
      tags: (data?.tags ?? '').trim(),
      comments: (data?.comments ?? '').trim(),
      featured: Boolean(data?.featured),
    };

    // Log form submission for debugging

    // Validate that we have retryable files to upload
    const retryableFiles = uploadFiles.filter(f => f.status === 'pending' || f.status === 'error');
    if (retryableFiles.length === 0) {
      console.warn('No files to upload or retry');
      return;
    }

    // Clear error state for files being retried
    setUploadFiles(prev =>
      prev.map(file =>
        file.status === 'error' ? { ...file, status: 'pending' as const, error: undefined } : file
      )
    );

    void uploadAllFiles(safeData);
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      // Safely cleanup all preview URLs
      uploadFiles.forEach(file => {
        try {
          if (file?.preview && typeof file.preview === 'string') {
            URL.revokeObjectURL(file.preview);
          }
        } catch (error) {
          console.warn('Failed to cleanup preview URL:', error);
        }
      });
      // Cleaned up preview URLs for PhotoUpload component
    };
  }, [uploadFiles]); // Include uploadFiles in dependencies to ensure cleanup

  const pendingCount = uploadFiles.filter(f => f.status === 'pending').length;
  const completedCount = uploadFiles.filter(f => f.status === 'completed').length;
  const errorCount = uploadFiles.filter(f => f.status === 'error').length;
  const retryableCount = uploadFiles.filter(
    f => f.status === 'pending' || f.status === 'error'
  ).length;
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
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="opacity-25"
                    />
                    <path
                      fill="currentColor"
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Uploading...
                </div>
              )}
            </div>

            {/* File List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {uploadFiles.map(file => (
                <motion.div
                  key={file.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative bg-white border rounded-lg p-3 space-y-2"
                >
                  {/* File Preview */}
                  <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
                    <img src={file.preview} alt="Preview" className="w-full h-full object-cover" />
                    {file.status === 'uploading' && (
                      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                        <div className="text-white text-sm">Uploading...</div>
                      </div>
                    )}
                    {file.status === 'completed' && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="h-6 w-6 text-green-500 bg-white rounded-full p-1"
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
                    )}
                    {file.status === 'error' && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="h-6 w-6 text-red-500 bg-white rounded-full p-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file?.name || 'Unknown file'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.file?.size && typeof file.file.size === 'number'
                        ? `${(file.file.size / 1024 / 1024).toFixed(1)} MB`
                        : 'Unknown size'}
                    </p>
                    {file.error && <p className="text-xs text-red-600">{file.error}</p>}
                    {file.status === 'error' && (
                      <p className="text-xs text-blue-600">Click "Retry" to try again</p>
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
            <form
              onSubmit={e => {
                void handleSubmit(onSubmit)(e);
              }}
              className="space-y-4 p-4 bg-gray-50 rounded-lg"
            >
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    {...register('category')}
                    type="text"
                    placeholder="e.g., Portrait, Landscape, Street"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Describe these photos..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
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
                  disabled={retryableCount === 0 || isUploading}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {isUploading ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="opacity-25"
                        />
                        <path
                          fill="currentColor"
                          className="opacity-75"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Uploading {retryableCount} photos...
                    </>
                  ) : (
                    <>
                      {errorCount > 0 && pendingCount === 0 ? 'Retry' : 'Upload'} {retryableCount}{' '}
                      photos
                    </>
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
