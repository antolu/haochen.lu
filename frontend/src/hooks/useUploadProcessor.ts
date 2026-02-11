import { useEffect, useRef, useCallback } from "react";
import { useUploadQueue } from "../stores/uploadQueue";
import { useUploadPhoto } from "./usePhotos";
import type { AxiosError } from "axios";

const MAX_CONCURRENT_UPLOADS = 2;

export const useUploadProcessor = () => {
  const { queue, isProcessing, setProcessing, updateUpload, getPendingCount } =
    useUploadQueue();

  const uploadMutation = useUploadPhoto();
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const processQueue = useCallback(() => {
    const pendingUploads = queue.filter((u) => u.status === "pending");
    const currentlyUploading = queue.filter((u) => u.status === "uploading");

    // Don't start new uploads if we're at max concurrency
    if (currentlyUploading.length >= MAX_CONCURRENT_UPLOADS) {
      return;
    }

    // Calculate how many new uploads we can start
    const availableSlots = MAX_CONCURRENT_UPLOADS - currentlyUploading.length;
    const uploadsToStart = pendingUploads.slice(0, availableSlots);

    for (const upload of uploadsToStart) {
      // Skip if no file (restored from storage)
      if (!upload.file) {
        updateUpload(upload.id, {
          status: "error",
          error: "File data lost. Please re-add this file to upload.",
        });
        continue;
      }

      // Skip if already processing
      if (activeUploadsRef.current.has(upload.id)) {
        continue;
      }

      activeUploadsRef.current.add(upload.id);

      // Create abort controller for this upload
      const abortController = new AbortController();
      abortControllersRef.current.set(upload.id, abortController);

      // Mark as uploading
      updateUpload(upload.id, { status: "uploading", progress: 0 });

      // Listen for progress events
      const handleProgress = (e: Event) => {
        const detail = (e as CustomEvent).detail as {
          uploadId?: string;
          progress?: number;
        };
        if (
          detail.uploadId === upload.id &&
          typeof detail.progress === "number"
        ) {
          updateUpload(upload.id, {
            progress: Math.max(0, Math.min(100, detail.progress)),
          });
        }
      };

      window.addEventListener(
        "upload:progress",
        handleProgress as EventListener,
      );

      // Start upload
      uploadMutation.mutate(
        {
          file: upload.file,
          metadata: {
            title:
              upload.metadata.title || upload.fileName.replace(/\.[^/.]+$/, ""),
            description: upload.metadata.description,
            category: upload.metadata.category,
            tags: upload.metadata.tags,
            comments: upload.metadata.comments,
            featured: upload.metadata.featured,
          },
        },
        {
          onSuccess: (data) => {
            updateUpload(upload.id, {
              status: "completed",
              progress: 100,
              completedAt: Date.now(),
              photoId: data.id,
            });
            activeUploadsRef.current.delete(upload.id);
            abortControllersRef.current.delete(upload.id);
            window.removeEventListener(
              "upload:progress",
              handleProgress as EventListener,
            );
          },
          onError: (error) => {
            const axiosError = error as AxiosError;
            let errorMessage = "Upload failed";

            // Provide specific error messages
            if (axiosError.response?.status === 413) {
              errorMessage = "File too large (max 50MB)";
            } else if (axiosError.response?.status === 415) {
              errorMessage = "Unsupported file type";
            } else if (axiosError.response?.status === 422) {
              const detail = (axiosError.response?.data as { detail?: string })
                ?.detail;
              errorMessage = detail ?? "Invalid image data";
            } else if (axiosError.response?.status === 500) {
              errorMessage = "Server error during processing";
            } else if (
              axiosError.code === "ECONNABORTED" ||
              axiosError.message.includes("timeout")
            ) {
              errorMessage = "Upload timed out";
            } else if (
              axiosError.code === "ERR_NETWORK" ||
              !axiosError.response
            ) {
              errorMessage = "Network error";
            } else {
              errorMessage =
                (axiosError.response?.data as { detail?: string })?.detail ??
                error.message ??
                "Upload failed";
            }

            updateUpload(upload.id, {
              status: "error",
              error: errorMessage,
            });
            activeUploadsRef.current.delete(upload.id);
            abortControllersRef.current.delete(upload.id);
            window.removeEventListener(
              "upload:progress",
              handleProgress as EventListener,
            );
          },
        },
      );
    }
  }, [queue, updateUpload, uploadMutation]);

  // Process queue when it changes
  useEffect(() => {
    const pendingCount = getPendingCount();

    if (pendingCount > 0 && !isProcessing) {
      setProcessing(true);
      void processQueue();
    } else if (pendingCount === 0 && isProcessing) {
      setProcessing(false);
    }
  }, [queue, isProcessing, getPendingCount, setProcessing, processQueue]);

  // Retry processing every 2 seconds if there are pending uploads
  useEffect(() => {
    const interval = setInterval(() => {
      const pendingCount = getPendingCount();
      if (pendingCount > 0) {
        void processQueue();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [getPendingCount, processQueue]);

  // Cleanup on unmount
  useEffect(() => {
    const abortControllers = abortControllersRef.current;
    const activeUploads = activeUploadsRef.current;
    return () => {
      // Cancel all active uploads
      abortControllers.forEach((controller) => {
        controller.abort();
      });
      abortControllers.clear();
      activeUploads.clear();
    };
  }, []);

  return {
    isProcessing,
    activeCount: activeUploadsRef.current.size,
  };
};
