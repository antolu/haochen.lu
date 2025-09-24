import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export interface UploadFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

interface PhotoDropzoneProps {
  onFilesAdded: (files: UploadFile[]) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  accept?: Record<string, string[]>;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const PhotoDropzone: React.FC<PhotoDropzoneProps> = ({
  onFilesAdded,
  maxFiles = 10,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  accept = {
    "image/*": [".jpeg", ".jpg", ".png", ".webp", ".gif"],
  },
  disabled = false,
  children,
  className,
}) => {
  // Helper function to format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  // Handle file drops
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      try {
        if (!acceptedFiles || acceptedFiles.length === 0) {
          return;
        }

        // Validate each file before processing
        const validFiles = acceptedFiles.filter((file) => {
          if (!(file instanceof File)) {
            console.warn("Invalid file object received:", file);
            return false;
          }

          if (!file.name) {
            console.warn("File missing name property:", file);
            return false;
          }

          if (file.size === 0) {
            console.warn("Empty file received:", file.name);
            return false;
          }

          if (file.size > maxFileSize) {
            console.warn(
              `File too large: ${file.name} (${formatFileSize(file.size)} > ${formatFileSize(maxFileSize)})`,
            );
            return false;
          }

          return true;
        });

        if (validFiles.length === 0) {
          console.warn("No valid files to process");
          return;
        }

        // Take only up to maxFiles
        const filesToProcess = validFiles.slice(0, maxFiles);

        if (filesToProcess.length < validFiles.length) {
          console.warn(
            `Only processing ${filesToProcess.length} of ${validFiles.length} files due to upload limit`,
          );
        }

        const newFiles: UploadFile[] = filesToProcess.map((file) => {
          const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          let preview = "";

          try {
            preview = URL.createObjectURL(file);
          } catch (error) {
            console.warn(
              "Failed to create preview URL for file:",
              file.name,
              error,
            );
            preview = "";
          }

          return {
            id,
            file,
            preview,
            progress: 0,
            status: "pending" as const,
          };
        });

        onFilesAdded(newFiles);
      } catch (error) {
        console.error("Error processing dropped files:", error);
      }
    },
    [onFilesAdded, maxFiles, maxFileSize, formatFileSize],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles,
    disabled,
  });

  // If children are provided, render them instead of default drop zone
  if (children) {
    return <div className={className}>{children}</div>;
  }

  // Default drop zone UI
  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-blue-500 bg-blue-50"
          : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className ?? ""}`}
    >
      <input {...getInputProps()} />
      <div className="space-y-3">
        <div className="text-4xl text-gray-400">📸</div>
        {isDragActive ? (
          <p className="text-blue-600 font-medium">Drop your photos here...</p>
        ) : (
          <>
            <p className="text-gray-600">
              <span className="font-medium text-blue-600">Click to upload</span>{" "}
              or drag and drop
            </p>
            <p className="text-sm text-gray-500">
              PNG, JPG, WEBP up to {formatFileSize(maxFileSize)} • Max{" "}
              {maxFiles} {maxFiles === 1 ? "file" : "files"}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoDropzone;
