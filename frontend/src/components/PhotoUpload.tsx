import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import PhotoDropzone, { type UploadFile } from "./PhotoDropzone";
import PhotoPreview from "./PhotoPreview";
import PhotoMetadataForm, { type PhotoMetadata } from "./PhotoMetadataForm";
import { useUploadPhoto } from "../hooks/usePhotos";
import type { AxiosError } from "axios";

interface PhotoUploadProps {
  onComplete?: () => void;
  onCancel?: () => void;
  maxFiles?: number;
  maxFileSize?: number;
  category?: string;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  onComplete,
  onCancel,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  category = "",
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [metadata, setMetadata] = useState<PhotoMetadata>({
    title: "",
    description: "",
    category: category || "",
    tags: "",
    comments: "",
    featured: false,
  });
  const uploadMutation = useUploadPhoto();

  // Watch for upload completion and call onComplete when all files are done
  useEffect(() => {
    if (uploadFiles.length === 0) return;

    const allCompleted = uploadFiles.every((f) => f.status === "completed");
    const hasErrors = uploadFiles.some((f) => f.status === "error");
    const hasUploading = uploadFiles.some((f) => f.status === "uploading");

    if (allCompleted && !hasErrors && !hasUploading && onComplete) {
      setTimeout(onComplete, 500);
    }
  }, [uploadFiles, onComplete]);

  const handleFilesAdded = (newFiles: UploadFile[]) => {
    const availableSlots = maxFiles - uploadFiles.length;
    const filesToAdd = newFiles.slice(0, availableSlots);
    setUploadFiles((prev) => [...prev, ...filesToAdd]);
  };

  const handleUpload = (file: UploadFile) => {
    setUploadFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "uploading" } : f)),
    );

    uploadMutation.mutate(
      {
        file: file.file,
        metadata: {
          title: metadata.title || file.file.name.replace(/\.[^/.]+$/, ""),
          description: metadata.description,
          category: metadata.category,
          tags: metadata.tags,
          comments: metadata.comments,
          featured: metadata.featured,
        },
      },
      {
        onSuccess: () => {
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? { ...f, status: "completed", progress: 100 }
                : f,
            ),
          );
        },
        onError: (error: AxiosError) => {
          setUploadFiles((prev) =>
            prev.map((f) =>
              f.id === file.id
                ? {
                    ...f,
                    status: "error",
                    error:
                      error.response?.data?.detail ||
                      error.message ||
                      "Upload failed",
                  }
                : f,
            ),
          );
        },
      },
    );
  };

  const handleRemove = (fileId: string) => {
    const file = uploadFiles.find((f) => f.id === fileId);
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
    setUploadFiles((prev) => prev.filter((f) => f.id !== fileId));
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

  const handleMetadataSubmit = (newMetadata: PhotoMetadata) => {
    setMetadata(newMetadata);

    // Upload all pending files
    const pendingFiles = uploadFiles.filter((f) => f.status === "pending");
    pendingFiles.forEach(handleUpload);
  };

  const handleCancel = () => {
    uploadFiles.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setUploadFiles([]);
    onCancel?.();
  };

  const hasFiles = uploadFiles.length > 0;
  const pendingFiles = uploadFiles.filter((f) => f.status === "pending");
  const completedFiles = uploadFiles.filter((f) => f.status === "completed");
  const errorFiles = uploadFiles.filter((f) => f.status === "error");
  const allCompleted =
    hasFiles && uploadFiles.every((f) => f.status === "completed");

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* Drop Zone */}
      {!hasFiles || uploadFiles.length < maxFiles ? (
        <PhotoDropzone
          onFilesAdded={handleFilesAdded}
          maxFiles={maxFiles - uploadFiles.length}
          maxFileSize={maxFileSize}
        />
      ) : null}

      {/* File Previews */}
      {hasFiles && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Photos ({uploadFiles.length})
            </h3>
          </div>

          <AnimatePresence>
            {uploadFiles.map((file) => (
              <PhotoPreview
                key={file.id}
                uploadFile={file}
                onRemove={() => handleRemove(file.id)}
                onRetry={() => handleRetry(file.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Metadata Form - Only show if we have pending files */}
      {hasFiles && pendingFiles.length > 0 && !allCompleted && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Photo Information
          </h3>
          <PhotoMetadataForm
            defaultValues={metadata}
            onSubmit={handleMetadataSubmit}
            onCancel={handleCancel}
            submitLabel={`Upload ${pendingFiles.length} Photo${pendingFiles.length !== 1 ? "s" : ""}`}
            isSubmitting={uploadMutation.isPending}
          />
        </div>
      )}

      {/* Completion State */}
      {allCompleted && (
        <div className="mt-8 text-center">
          <div className="text-green-600 text-lg font-medium mb-4">
            ✓ All photos uploaded successfully!
          </div>
          <div className="text-sm text-gray-600 mb-4">
            {completedFiles.length} photo
            {completedFiles.length !== 1 ? "s" : ""} ready
          </div>
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* Error Summary */}
      {errorFiles.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 font-medium">
            {errorFiles.length} photo{errorFiles.length !== 1 ? "s" : ""} failed
            to upload
          </div>
          <div className="text-red-600 text-sm mt-1">
            Please check the errors above and try again
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoUpload;
