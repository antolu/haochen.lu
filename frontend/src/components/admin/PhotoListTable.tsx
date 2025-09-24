import React, { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Trash2, Star, Calendar, Camera, MapPin } from "lucide-react";
import type { Photo } from "../../types";
import { useDeletePhoto, useTogglePhotoFeatured } from "../../hooks/usePhotos";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";
import { DataTable } from "../ui/data-table";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { formatDateSimple } from "../../utils/dateFormat";
import { cn } from "../../lib/utils";

interface PhotoListTableProps {
  photos: Photo[];
  isLoading?: boolean;
  onEdit: (photo: Photo) => void;
}

const PhotoListTable: React.FC<PhotoListTableProps> = ({
  photos,
  isLoading = false,
  onEdit,
}) => {
  // Drag and drop state removed for now
  // const [dragIndex, setDragIndex] = useState<number | null>(null);
  // const [localOrder, setLocalOrder] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<"table" | "grid">("grid");

  const deleteMutation = useDeletePhoto();
  const toggleFeaturedMutation = useTogglePhotoFeatured();
  // const reorderMutation = useReorderPhotos(); // Removed for now

  const sorted = useMemo(() => {
    const arr = [...photos];
    arr.sort((a, b) =>
      a.order !== b.order
        ? a.order - b.order
        : new Date(b.date_taken ?? b.created_at).getTime() -
          new Date(a.date_taken ?? a.created_at).getTime(),
    );
    return arr;
  }, [photos]);

  const handleToggleFeatured = useCallback(
    async (photo: Photo) => {
      await toggleFeaturedMutation.mutateAsync({
        id: photo.id,
        featured: !photo.featured,
      });
    },
    [toggleFeaturedMutation],
  );

  const handleDelete = useCallback(
    async (photoId: string) => {
      if (window.confirm("Are you sure you want to delete this photo?")) {
        await deleteMutation.mutateAsync(photoId);
      }
    },
    [deleteMutation],
  );

  const columns: Array<{
    key: string;
    title: string;
    width?: string;
    searchable?: boolean;
    sortable?: boolean;
    render: (value: unknown, photo: Photo) => React.ReactNode;
  }> = [
    {
      key: "thumbnail",
      title: "Photo",
      width: "20",
      render: (_: unknown, photo: Photo) => {
        const imageUrl = selectOptimalImage(photo, ImageUseCase.THUMBNAIL).url;
        return (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt={photo.title || "Photo"}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {photo.featured && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-yellow-400 rounded-bl-lg">
                <Star className="w-2 h-2 text-yellow-900 absolute top-0.5 right-0.5" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "title",
      title: "Title",
      searchable: true,
      sortable: true,
      render: (_: unknown, photo: Photo) => (
        <div>
          <div className="font-medium">{photo.title || "Untitled"}</div>
          {photo.description && (
            <div className="text-sm text-muted-foreground truncate max-w-xs">
              {photo.description}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "metadata",
      title: "Details",
      render: (_: unknown, photo: Photo) => (
        <div className="space-y-1">
          {photo.date_taken && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formatDateSimple(photo.date_taken)}
            </div>
          )}
          {photo.camera_make && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="w-3 h-3" />
              {photo.camera_make} {photo.camera_model}
            </div>
          )}
          {photo.location_name && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {photo.location_name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "tags",
      title: "Tags",
      render: (_: unknown, photo: Photo) => (
        <div className="flex flex-wrap gap-1">
          {photo.tags
            ?.split(",")
            .slice(0, 3)
            .map((tag: string) => (
              <Badge key={tag.trim()} variant="secondary" className="text-xs">
                {tag.trim()}
              </Badge>
            ))}
          {(photo.tags?.split(",").length ?? 0) > 3 && (
            <Badge variant="outline" className="text-xs">
              +{(photo.tags?.split(",").length ?? 0) - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "status",
      title: "Status",
      render: (_: unknown, photo: Photo) => (
        <div className="space-y-1">
          {photo.featured && (
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
              Featured
            </Badge>
          )}
          {photo.category && (
            <Badge variant="outline" className="text-xs">
              {photo.category}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      title: "Actions",
      render: (_: unknown, photo: Photo) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleToggleFeatured(photo);
            }}
            className="h-8 w-8 p-0"
          >
            {photo.featured ? (
              <Star className="h-4 w-4 fill-current text-yellow-500" />
            ) : (
              <Star className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(photo)}
            className="h-8 w-8 p-0"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void handleDelete(photo.id);
            }}
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  const GridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <AnimatePresence>
        {sorted.map((photo, index) => {
          const imageUrl = selectOptimalImage(
            photo,
            ImageUseCase.THUMBNAIL,
          ).url;
          return (
            <motion.div
              key={photo.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="group overflow-hidden hover:shadow-md transition-all duration-200">
                <div className="aspect-square relative overflow-hidden bg-muted">
                  <img
                    src={imageUrl}
                    alt={photo.title || "Photo"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    loading="lazy"
                  />
                  {photo.featured && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        <Star className="w-3 h-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="flex gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void handleToggleFeatured(photo);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            photo.featured && "fill-current text-yellow-500",
                          )}
                        />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(photo)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          void handleDelete(photo.id);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-medium truncate">
                    {photo.title || "Untitled"}
                  </h3>
                  {photo.description && (
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {photo.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-wrap gap-1">
                      {photo.tags
                        ?.split(",")
                        .slice(0, 2)
                        .map((tag) => (
                          <Badge
                            key={tag.trim()}
                            variant="secondary"
                            className="text-xs"
                          >
                            {tag.trim()}
                          </Badge>
                        ))}
                    </div>
                    {photo.date_taken && (
                      <span className="text-xs text-muted-foreground">
                        {formatDateSimple(photo.date_taken)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );

  // Drag and drop functionality removed for now - can be re-added later
  // const handleDrop = (dropIndex: number) => { ... }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">
          Loading photos...
        </div>
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="text-center py-8">
        <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">No photos found</h3>
        <p className="text-muted-foreground">
          Start by uploading some photos to your gallery.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {sorted.length} photo{sorted.length !== 1 ? "s" : ""} total
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <GridView />
      ) : (
        <DataTable
          data={sorted}
          columns={columns}
          searchPlaceholder="Search photos by title or description..."
          onRowClick={onEdit}
          emptyMessage="No photos match your search."
        />
      )}
    </div>
  );
};

export default PhotoListTable;
