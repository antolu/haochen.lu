import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCcw } from "lucide-react";
import { Switch } from "../../components/ui/switch";
// photoswipe not used in admin (editor replaces lightbox)

import PhotoUpload from "../../components/PhotoUpload";
import SortablePhotoGrid from "../../components/SortablePhotoGrid";
import PhotoEditorDrawer from "../../components/admin/PhotoEditorDrawer";
import PhotoForm from "../../components/admin/PhotoForm";
import SortablePhotoList from "../../components/admin/SortablePhotoList";
import {
  usePhotos,
  usePhotoStats,
  useDeletePhoto,
  useTogglePhotoFeatured,
  useReorderPhotos,
} from "../../hooks/usePhotos";
import type { Photo } from "../../types";
import toast from "react-hot-toast";
import { cn } from "../../lib/utils";

const AdminPhotos: React.FC = () => {
  const [showUpload, setShowUpload] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [reorderEnabled, setReorderEnabled] = useState(false);

  // Query hooks
  const {
    data: photosData,
    isLoading: isLoadingPhotos,
    error: photosError,
  } = usePhotos();
  const { data: statsData, isLoading: isLoadingStats } = usePhotoStats();

  // Mutation hooks
  const deleteMutation = useDeletePhoto();
  const toggleFeaturedMutation = useTogglePhotoFeatured();
  const reorderMutation = useReorderPhotos();
  const isReordering = reorderMutation.isPending;

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
      setSelectedPhotos(new Set(photos.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedPhotos.size} photo${selectedPhotos.size > 1 ? "s" : ""}? This action cannot be undone.`;
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
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const buildOrderPayload = (orderedPhotos: Photo[]) =>
    orderedPhotos.map((photo, index) => ({ id: photo.id, order: index + 1 }));

  const handleReorder = async (orderedPhotos: Photo[]) => {
    if (orderedPhotos.length === 0) {
      return;
    }

    const items = buildOrderPayload(orderedPhotos);
    try {
      await reorderMutation.mutateAsync({ items, normalize: true });
      toast.success("Photo order updated.");
    } catch {
      // errors handled by hook toast
    }
  };

  const handleResetOrder = async () => {
    if (photos.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      "Reset photo ordering back to upload date? Any custom ordering will be lost.",
    );
    if (!confirmed) return;

    const resetOrder = [...photos].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    try {
      await reorderMutation.mutateAsync({
        items: buildOrderPayload(resetOrder),
        normalize: true,
      });
      toast.success("Photo order reset to upload order.");
    } catch {
      // handled by hook
    }
  };

  const handleViewModeChange = (mode: "grid" | "list") => {
    setViewMode(mode);
  };

  if (photosError) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">
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
        <p className="text-muted-foreground">{photosError.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Photos</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your photo collection
            </p>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <div className="flex bg-muted rounded-full p-1">
                <button
                  onClick={() => handleViewModeChange("grid")}
                  className={cn(
                    "px-4 py-1 text-sm font-medium rounded-full transition-colors",
                    viewMode === "grid"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Grid
                </button>
                <button
                  onClick={() => handleViewModeChange("list")}
                  className={cn(
                    "px-4 py-1 text-sm font-medium rounded-full transition-colors",
                    viewMode === "list"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  List
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Reorder
                </span>
                <Switch
                  checked={reorderEnabled}
                  onCheckedChange={(checked) => {
                    if (!photos.length && checked) {
                      toast.error("Add some photos before reordering.");
                      return;
                    }
                    setReorderEnabled(checked);
                  }}
                />
              </div>
              <AnimatePresence>
                {reorderEnabled && (
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.95, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95, x: -20 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => {
                      void handleResetOrder();
                    }}
                    className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground transition hover:border-primary hover:text-primary"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reset to Upload Order
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => setShowUpload(true)}
              disabled={showUpload || reorderEnabled || isReordering}
              className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-sm"
            >
              <span className="flex items-center">
                <svg
                  className="h-4 w-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-blue-600 dark:text-blue-400"
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
                  <p className="text-sm font-medium">Total Photos</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.total_photos || photos.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-yellow-600 dark:text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium">Featured</p>
                  <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.featured_photos ||
                      photos.filter((p) => p.featured).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-green-600 dark:text-green-400"
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
                  <p className="text-sm font-medium">Storage Used</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatFileSize(
                      stats.total_size ||
                        photos.reduce((sum, p) => sum + (p.file_size || 0), 0),
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg border p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="h-4 w-4 text-purple-600 dark:text-purple-400"
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
                  <p className="text-sm font-medium">Selected</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedPhotos.size}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPhotos.size > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-700 dark:text-blue-400">
              {selectedPhotos.size} photo{selectedPhotos.size > 1 ? "s" : ""}{" "}
              selected
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  void handleBulkToggleFeatured(true);
                }}
                className="px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 dark:text-yellow-300 dark:bg-yellow-900/30 dark:hover:bg-yellow-900/40 rounded border border-yellow-300 dark:border-yellow-600 transition-colors shadow-sm"
              >
                ⭐ Feature
              </button>
              <button
                onClick={() => {
                  void handleBulkToggleFeatured(false);
                }}
                className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded border transition-colors"
              >
                Remove Feature
              </button>
              <button
                onClick={() => {
                  void handleBulkDelete();
                }}
                className="px-3 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-300 dark:bg-red-900/30 dark:hover:bg-red-900/40 rounded border border-red-300 dark:border-red-600 transition-colors shadow-sm"
              >
                🗑 Delete
              </button>
              <button
                onClick={() => setSelectedPhotos(new Set())}
                className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted hover:bg-muted/80 rounded border transition-colors"
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
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowUpload(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background border rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Upload Photos</h2>
                  <button
                    onClick={() => setShowUpload(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <svg
                      className="h-6 w-6"
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
      <div className="bg-card rounded-lg border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">All Photos ({photos.length})</h2>

          {photos.length > 0 && !editingPhoto && (
            <button
              onClick={() => handleSelectAll()}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
            >
              {selectedPhotos.size === photos.length
                ? "Deselect All"
                : "Select All"}
            </button>
          )}
        </div>

        {viewMode === "grid" ? (
          editingPhoto ? (
            <PhotoForm
              photo={editingPhoto}
              onCancel={() => setEditingPhoto(null)}
              onSuccess={() => setEditingPhoto(null)}
            />
          ) : (
            <div className="min-h-[600px]">
              <SortablePhotoGrid
                photos={photos}
                reorderEnabled={reorderEnabled}
                onReorder={(items) => void handleReorder(items)}
                disabled={isReordering}
                onPhotoClick={handlePhotoClick}
              />
            </div>
          )
        ) : (
          <SortablePhotoList
            photos={photos}
            reorderEnabled={reorderEnabled}
            viewMode={viewMode}
            onReorder={(ordered) => {
              void handleReorder(ordered);
            }}
            onEdit={(photo) => {
              if (reorderEnabled) return;
              setEditingPhoto(photo);
            }}
            onToggleFeatured={(photo) => {
              if (reorderEnabled) return;
              void toggleFeaturedMutation.mutateAsync({
                id: photo.id,
                featured: !photo.featured,
              });
            }}
            onDelete={(photo) => {
              if (reorderEnabled) return;
              void deleteMutation.mutateAsync(photo.id);
            }}
            isLoading={isLoadingPhotos}
          />
        )}
      </div>
      {/* Drawer for list view edits */}
      <AnimatePresence>
        {viewMode === "list" && editingPhoto && (
          <PhotoEditorDrawer
            photo={editingPhoto}
            onClose={() => setEditingPhoto(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPhotos;
