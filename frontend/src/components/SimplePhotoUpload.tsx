import React, { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import PhotoDropzone, { type UploadFile } from "./PhotoDropzone";
import PhotoPreview from "./PhotoPreview";
import { useUploadPhoto } from "../hooks/usePhotos";
import type { Photo } from "../types";
import type { AxiosError } from "axios";

interface SimplePhotoUploadProps {
  onComplete?: (photo: Photo) => void;
  onCancel?: () => void;
  maxFiles?: number;
  maxFileSize?: number;
  category?: string;
  autoUpload?: boolean;
}

const SimplePhotoUpload: React.FC<SimplePhotoUploadProps> = ({
  onComplete,
  onCancel,
  maxFiles = 1,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  category = "hero",
  autoUpload = true,
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<Map<string, Photo>>(
    new Map(),
  );
  const uploadMutation = useUploadPhoto();

  const handleUpload = useCallback(
    (file: UploadFile) => {
      // Update status to uploading
      setUploadFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: "uploading" } : f)),
      );

      uploadMutation.mutate(
        {
          file: file.file,
          metadata: {
            title: file.file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
            description: "",
            category,
            tags: "",
            featured: false,
          },
        },
        {
          onSuccess: (uploadedPhoto) => {
            setUploadFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? { ...f, status: "completed", progress: 100 }
                  : f,
              ),
            );
            setUploadedPhotos(
              (prev) => new Map(prev.set(file.id, uploadedPhoto)),
            );
          },
          onError: (error) => {
            console.error("Upload failed:", error);
            const axiosError = error as AxiosError;
            const errorMessage =
              (axiosError.response?.data as { detail?: string })?.detail ??
              error.message ??
              "Upload failed";
            setUploadFiles((prev) =>
              prev.map((f) =>
                f.id === file.id
                  ? {
                      ...f,
                      status: "error",
                      error: errorMessage,
                    }
                  : f,
              ),
            );
          },
        },
      );
    },
    [uploadMutation, category, setUploadFiles, setUploadedPhotos],
  );

  // Auto-upload files when they're added (if enabled)
  useEffect(() => {
    if (!autoUpload) return;

    const pendingFiles = uploadFiles.filter(
      (file) => file.status === "pending",
    );
    if (pendingFiles.length === 0) return;

    // Upload the first pending file
    const file = pendingFiles[0];
    handleUpload(file);
  }, [uploadFiles, autoUpload, handleUpload]);

  // Call onComplete when upload is finished
  useEffect(() => {
    const completedFiles = uploadFiles.filter((f) => f.status === "completed");
    if (completedFiles.length > 0 && onComplete) {
      const fileId = completedFiles[0].id;
      const photo = uploadedPhotos.get(fileId);
      if (photo) {
        // Small delay to show completion state
        setTimeout(() => onComplete(photo), 500);
      }
    }
  }, [uploadFiles, uploadedPhotos, onComplete]);

  const handleFilesAdded = (newFiles: UploadFile[]) => {
    setUploadFiles(newFiles);
  };

  const handleRemove = (fileId: string) => {
    const file = uploadFiles.find((f) => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
    setUploadedPhotos((prev) => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  };

  const handleRetry = (fileId: string) => {
    const file = uploadFiles.find((f) => f.id === fileId);
    if (file) {
      setUploadFiles((prev) =>
        prev.map((f) =>
          f.id === fileId ? { ...f, status: "pending", error: undefined } : f,
        ),
      );
      handleUpload(file);
    }
  };

  const handleCancel = () => {
    // Clean up any preview URLs
    uploadFiles.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setUploadFiles([]);
    setUploadedPhotos(new Map());
    onCancel?.();
  };

  const hasFiles = uploadFiles.length > 0;
  const allCompleted =
    uploadFiles.length > 0 &&
    uploadFiles.every((f) => f.status === "completed");
  const hasErrors = uploadFiles.some((f) => f.status === "error");

  return (
    <div className="space-y-4">
      {/* Drop zone - only show if no files or if we allow multiple files */}
      {(!hasFiles || maxFiles > 1) && (
        <PhotoDropzone
          onFilesAdded={handleFilesAdded}
          maxFiles={maxFiles - uploadFiles.length}
          maxFileSize={maxFileSize}
          disabled={hasFiles && maxFiles === 1}
        />
      )}

      {/* File Previews */}
      <AnimatePresence>
        {uploadFiles.map((file) => (
          <PhotoPreview
            key={file.id}
            uploadFile={file}
            uploadedPhoto={uploadedPhotos.get(file.id)}
            onRemove={() => handleRemove(file.id)}
            onRetry={() => handleRetry(file.id)}
          />
        ))}
      </AnimatePresence>

      {/* Action Buttons */}
      {hasFiles && (
        <div className="flex justify-end space-x-4">
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {allCompleted ? "Done" : "Cancel"}
          </button>

          {!autoUpload && !allCompleted && !hasErrors && (
            <button
              onClick={() => {
                const pendingFiles = uploadFiles.filter(
                  (f) => f.status === "pending",
                );
                pendingFiles.forEach(handleUpload);
              }}
              disabled={uploadMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SimplePhotoUpload;
