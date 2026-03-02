import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCcw,
  Camera,
  Star,
  HardDrive,
  CheckSquare,
  Plus,
} from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { Button } from "../../components/ui/button";
import StatCard from "../../components/admin/StatCard";
// photoswipe not used in admin (editor replaces lightbox)

import PhotoUpload from "../../components/PhotoUpload";
import SortablePhotoGrid from "../../components/SortablePhotoGrid";
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
  const [showStats, setShowStats] = useState(false);

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
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-3">
            <h1 className="admin-page-title">Photos</h1>
            <p className="text-muted-foreground text-xl">
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Reorder Mode
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
                {!reorderEnabled && (
                  <span className="text-xs text-muted-foreground">
                    Current order: Custom / Manual
                  </span>
                )}
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
                    className="inline-flex items-center gap-2 rounded-full bg-muted/30 px-3 py-1 text-sm text-muted-foreground transition hover:bg-muted/50 hover:text-primary"
                  >
                    <RefreshCcw className="h-4 w-4" /> Reset to Upload Order
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Upload Button */}
            <Button
              variant="gradient"
              size="lg"
              onClick={() => setShowUpload(true)}
              disabled={showUpload || reorderEnabled || isReordering}
            >
              <Plus className="h-5 w-5 mr-2" />
              Upload Photos
            </Button>
          </div>
        </div>

        {/* Stats Cards - Collapsible */}
        {!isLoadingStats && (
          <div className="mt-6">
            <button
              onClick={() => setShowStats(!showStats)}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 mb-3"
            >
              <svg
                className={cn(
                  "h-4 w-4 transition-transform",
                  showStats && "rotate-90",
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {showStats ? "Hide" : "Show"} detailed stats
            </button>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
              >
                <StatCard
                  title="Total Photos"
                  value={stats.total_photos || photos.length}
                  gradient="from-blue-500/20 to-blue-600/20"
                  iconBg="bg-blue-50/50 dark:bg-blue-950/20"
                  icon={
                    <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  }
                />
                <StatCard
                  title="Featured"
                  value={
                    stats.featured_photos ||
                    photos.filter((p) => p.featured).length
                  }
                  gradient="from-yellow-500/20 to-yellow-600/20"
                  iconBg="bg-yellow-50/50 dark:bg-yellow-950/20"
                  icon={
                    <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  }
                />
                <StatCard
                  title="Storage Used"
                  value={formatFileSize(
                    stats.total_size ||
                      photos.reduce((sum, p) => sum + (p.file_size || 0), 0),
                  )}
                  gradient="from-green-500/20 to-green-600/20"
                  iconBg="bg-green-50/50 dark:bg-green-950/20"
                  icon={
                    <HardDrive className="w-5 h-5 text-green-600 dark:text-green-400" />
                  }
                />
                <StatCard
                  title="Selected"
                  value={selectedPhotos.size}
                  gradient="from-purple-500/20 to-purple-600/20"
                  iconBg="bg-purple-50/50 dark:bg-purple-950/20"
                  icon={
                    <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  }
                />
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedPhotos.size > 0 && (
        <div className="mb-6 p-4 bg-primary/10 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-primary font-medium">
              {selectedPhotos.size} photo{selectedPhotos.size > 1 ? "s" : ""}{" "}
              selected
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-700 dark:hover:bg-yellow-950/30"
                onClick={() => {
                  void handleBulkToggleFeatured(true);
                }}
              >
                ⭐ Feature
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleBulkToggleFeatured(false);
                }}
              >
                Remove Feature
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  void handleBulkDelete();
                }}
              >
                🗑 Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPhotos(new Set())}
              >
                Clear
              </Button>
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
              className="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
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
      <div className="bg-card rounded-xl shadow-lg border-border/40 p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">
            All Photos ({photos.length})
          </h2>

          {photos.length > 0 && !editingPhoto && (
            <Button variant="ghost" size="sm" onClick={() => handleSelectAll()}>
              {selectedPhotos.size === photos.length
                ? "Deselect All"
                : "Select All"}
            </Button>
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
        ) : editingPhoto ? (
          <PhotoForm
            photo={editingPhoto}
            onCancel={() => setEditingPhoto(null)}
            onSuccess={() => setEditingPhoto(null)}
          />
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
    </div>
  );
};

export default AdminPhotos;
