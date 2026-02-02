import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface QueuedUpload {
  id: string;
  file: File | null; // null if restored from storage
  fileName: string;
  fileSize: number;
  fileType: string;
  status: "pending" | "uploading" | "completed" | "error" | "paused";
  progress: number;
  error?: string;
  metadata: {
    title: string;
    description: string;
    category: string;
    tags: string;
    comments: string;
    featured: boolean;
  };
  createdAt: number;
  completedAt?: number;
  photoId?: string; // Set when upload completes
}

interface UploadQueueState {
  queue: QueuedUpload[];
  isProcessing: boolean;

  // Queue management
  addToQueue: (upload: QueuedUpload) => void;
  removeFromQueue: (id: string) => void;
  updateUpload: (id: string, updates: Partial<QueuedUpload>) => void;
  clearCompleted: () => void;
  clearAll: () => void;

  // Upload control
  pauseUpload: (id: string) => void;
  resumeUpload: (id: string) => void;
  retryUpload: (id: string) => void;

  // Processing state
  setProcessing: (processing: boolean) => void;

  // Statistics
  getPendingCount: () => number;
  getCompletedCount: () => number;
  getErrorCount: () => number;
}

export const useUploadQueue = create<UploadQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      isProcessing: false,

      addToQueue: (upload) => {
        set((state) => ({
          queue: [...state.queue, upload],
        }));
      },

      removeFromQueue: (id) => {
        set((state) => ({
          queue: state.queue.filter((u) => u.id !== id),
        }));
      },

      updateUpload: (id, updates) => {
        set((state) => ({
          queue: state.queue.map((u) =>
            u.id === id ? { ...u, ...updates } : u,
          ),
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          queue: state.queue.filter((u) => u.status !== "completed"),
        }));
      },

      clearAll: () => {
        // Only clear completed and error uploads, keep pending/uploading
        set((state) => ({
          queue: state.queue.filter(
            (u) => u.status === "pending" || u.status === "uploading",
          ),
        }));
      },

      pauseUpload: (id) => {
        set((state) => ({
          queue: state.queue.map((u) =>
            u.id === id && u.status === "uploading"
              ? { ...u, status: "paused" as const }
              : u,
          ),
        }));
      },

      resumeUpload: (id) => {
        set((state) => ({
          queue: state.queue.map((u) =>
            u.id === id && u.status === "paused"
              ? { ...u, status: "pending" as const }
              : u,
          ),
        }));
      },

      retryUpload: (id) => {
        set((state) => ({
          queue: state.queue.map((u) =>
            u.id === id && u.status === "error"
              ? {
                  ...u,
                  status: "pending" as const,
                  error: undefined,
                  progress: 0,
                }
              : u,
          ),
        }));
      },

      setProcessing: (processing) => {
        set({ isProcessing: processing });
      },

      getPendingCount: () => {
        return get().queue.filter(
          (u) => u.status === "pending" || u.status === "uploading",
        ).length;
      },

      getCompletedCount: () => {
        return get().queue.filter((u) => u.status === "completed").length;
      },

      getErrorCount: () => {
        return get().queue.filter((u) => u.status === "error").length;
      },
    }),
    {
      name: "upload-queue-storage",
      // Custom storage to handle File objects (can't be serialized)
      partialize: (state) => ({
        queue: state.queue.map((upload) => ({
          ...upload,
          // Don't persist the File object, just metadata
          file: null,
          // Store file metadata for display
          fileName: upload.file?.name ?? upload.fileName,
          fileSize: upload.file?.size ?? upload.fileSize,
          fileType: upload.file?.type ?? upload.fileType,
        })),
        isProcessing: false, // Always start fresh
      }),
    },
  ),
);
