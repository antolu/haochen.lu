import React from "react";
import { motion } from "framer-motion";
import type { UploadFile } from "./PhotoDropzone";
import type { Photo } from "../types";

interface PhotoPreviewProps {
  uploadFile: UploadFile;
  uploadedPhoto?: Photo;
  onRemove?: () => void;
  onRetry?: () => void;
  showActions?: boolean;
}

const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  uploadFile,
  uploadedPhoto,
  onRemove,
  onRetry,
  showActions = true,
}) => {
  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border border-gray-200 rounded-lg p-4"
    >
      <div className="flex items-center space-x-4">
        {/* Preview Image */}
        <div className="flex-shrink-0">
          {uploadFile.preview && (
            <img
              src={uploadFile.preview}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {uploadFile.file.name}
          </div>
          <div className="text-sm text-gray-500">
            {formatFileSize(uploadFile.file.size)}
          </div>

          {/* Progress Bar - Only show when uploading */}
          {uploadFile.status === "uploading" && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Uploading...</span>
                <span>{Math.round(uploadFile.progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadFile.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Messages */}
          {uploadFile.status === "completed" && (
            <div className="mt-2 flex items-center space-x-2">
              <div className="text-sm text-green-600 font-medium">
                ✓ Upload completed successfully!
              </div>
              {uploadedPhoto && (
                <div className="text-xs text-gray-500">
                  ID: {uploadedPhoto.id.slice(0, 8)}...
                </div>
              )}
            </div>
          )}

          {uploadFile.status === "error" && (
            <div className="mt-2 text-sm text-red-600">
              ✗ {uploadFile.error ?? "Upload failed"}
            </div>
          )}

          {uploadFile.status === "pending" && (
            <div className="mt-2 text-sm text-gray-500">Ready to upload</div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex-shrink-0 flex space-x-2">
            {uploadFile.status === "error" && onRetry && (
              <button
                onClick={onRetry}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Retry
              </button>
            )}

            {(uploadFile.status === "error" ||
              uploadFile.status === "completed") &&
              onRemove && (
                <button
                  onClick={onRemove}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Remove
                </button>
              )}

            {uploadFile.status === "uploading" && onRemove && (
              <button
                onClick={onRemove}
                className="text-gray-600 hover:text-gray-800 text-sm font-medium"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PhotoPreview;
