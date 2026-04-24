import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCcw,
  Camera,
  Star,
  HardDrive,
  CheckSquare,
  Plus,
  Trash2,
  X,
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

  const handleToggleSelection = (id: string) => {
    setSelectedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      <div className="mb-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b pb-8">
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Photos
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage and organize your visual portfolio
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex bg-muted/50 p-1 rounded-xl border border-border/50">
              <button
                onClick={() => handleViewModeChange("grid")}
                className={cn(
                  "px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                )}
              >
                Grid
              </button>
              <button
                onClick={() => handleViewModeChange("list")}
                className={cn(
                  "px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-200",
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                )}
              >
                List
              </button>
            </div>

            <div className="h-8 w-[1px] bg-border/60 hidden sm:block mx-2" />

            <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-xl border border-dashed border-border/60">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
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

            <Button
              variant="gradient"
              size="lg"
              onClick={() => setShowUpload(true)}
              disabled={showUpload || reorderEnabled || isReordering}
              className="rounded-full px-8 shadow-xl shadow-primary/20"
            >
              <Plus className="h-5 w-5 mr-2" />
              Upload Photos
            </Button>
          </div>
        </div>

        {/* Reorder Reset Button - Floating / Contextual */}
        <AnimatePresence>
          {reorderEnabled && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 flex justify-end"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleResetOrder()}
                className="rounded-full bg-background/50 backdrop-blur-sm border-dashed border-primary/30 text-primary hover:bg-primary/5"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-2" />
                Reset to Upload Order
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats Cards - Collapsible */}
      {!isLoadingStats && (
        <div className="mb-10">
          <button
            onClick={() => setShowStats(!showStats)}
            className="group flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/50 group-hover:bg-muted">
              <svg
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  showStats && "rotate-90",
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
            {showStats ? "Hide library insights" : "Show library insights"}
          </button>
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  <StatCard
                    title="Total Photos"
                    value={stats.total_photos || photos.length}
                    gradient="from-blue-500/10 to-blue-600/10"
                    iconBg="bg-blue-500/10"
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
                    gradient="from-yellow-500/10 to-yellow-600/10"
                    iconBg="bg-yellow-500/10"
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
                    gradient="from-emerald-500/10 to-emerald-600/10"
                    iconBg="bg-emerald-500/10"
                    icon={
                      <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    }
                  />
                  <StatCard
                    title="Selected Items"
                    value={selectedPhotos.size}
                    gradient="from-purple-500/10 to-purple-600/10"
                    iconBg="bg-purple-500/10"
                    icon={
                      <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    }
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedPhotos.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-2xl px-4"
          >
            <div className="bg-card/90 backdrop-blur-md border border-primary/20 shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 text-primary h-10 w-10 rounded-xl flex items-center justify-center font-bold">
                  {selectedPhotos.size}
                </div>
                <div>
                  <div className="font-bold text-sm">Photos selected</div>
                  <div className="text-xs text-muted-foreground">
                    Manage selection
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-yellow-500/30 hover:bg-yellow-500/5 text-yellow-600 dark:text-yellow-500"
                  onClick={() => {
                    void handleBulkToggleFeatured(true);
                  }}
                >
                  <Star className="h-3.5 w-3.5 mr-2 fill-current" />
                  Feature
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    void handleBulkToggleFeatured(false);
                  }}
                >
                  Unhighlight
                </Button>

                <div className="h-6 w-[1px] bg-border mx-1" />

                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Really delete ${selectedPhotos.size} photos?`,
                    );
                    if (confirmed) void handleBulkDelete();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedPhotos(new Set())}
                  className="rounded-full h-8 w-8 p-0"
                  title="Clear selection"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              onDelete={(photo) => {
                const confirmed = window.confirm(
                  "Are you sure you want to delete this photo?",
                );
                if (confirmed) {
                  void deleteMutation.mutateAsync(photo.id);
                  setEditingPhoto(null);
                }
              }}
              onToggleFeatured={(photo) => {
                void toggleFeaturedMutation.mutateAsync({
                  id: photo.id,
                  featured: !photo.featured,
                });
              }}
            />
          ) : (
            <div className="min-h-[600px]">
              <SortablePhotoGrid
                photos={photos}
                reorderEnabled={reorderEnabled}
                onReorder={(items) => void handleReorder(items)}
                disabled={isReordering}
                selectedIds={selectedPhotos}
                onToggleSelection={handleToggleSelection}
                onPhotoClick={handlePhotoClick}
                onDelete={(photo) => {
                  if (reorderEnabled) return;
                  const confirmed = window.confirm(
                    "Are you sure you want to delete this photo?",
                  );
                  if (confirmed) {
                    void deleteMutation.mutateAsync(photo.id);
                  }
                }}
                onToggleFeatured={(photo) => {
                  if (reorderEnabled) return;
                  void toggleFeaturedMutation.mutateAsync({
                    id: photo.id,
                    featured: !photo.featured,
                  });
                }}
              />
            </div>
          )
        ) : editingPhoto ? (
          <PhotoForm
            photo={editingPhoto}
            onCancel={() => setEditingPhoto(null)}
            onSuccess={() => setEditingPhoto(null)}
            onDelete={(photo) => {
              const confirmed = window.confirm(
                "Are you sure you want to delete this photo?",
              );
              if (confirmed) {
                void deleteMutation.mutateAsync(photo.id);
                setEditingPhoto(null);
              }
            }}
            onToggleFeatured={(photo) => {
              void toggleFeaturedMutation.mutateAsync({
                id: photo.id,
                featured: !photo.featured,
              });
            }}
          />
        ) : (
          <SortablePhotoList
            photos={photos}
            reorderEnabled={reorderEnabled}
            onReorder={(ordered) => {
              void handleReorder(ordered);
            }}
            selectedIds={selectedPhotos}
            onToggleSelection={handleToggleSelection}
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
              const confirmed = window.confirm(
                "Are you sure you want to delete this photo?",
              );
              if (confirmed) {
                void deleteMutation.mutateAsync(photo.id);
              }
            }}
            isLoading={isLoadingPhotos}
          />
        )}
      </div>
    </div>
  );
};

export default AdminPhotos;
