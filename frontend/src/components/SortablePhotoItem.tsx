import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Move, Star, Trash2 } from "lucide-react";
import type { Photo } from "../types";
import { cn } from "../lib/utils";
import { formatDateSimple } from "../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";
import { Button } from "./ui/button";

interface SortablePhotoCardProps {
  photo: Photo;
  index: number;
  reorderEnabled?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onToggleSelection?: (id: string) => void;
  onPhotoClick?: (photo: Photo, index: number) => void;
  onDelete?: (photo: Photo) => void;
  onToggleFeatured?: (photo: Photo) => void;
}

const SortablePhotoCard: React.FC<SortablePhotoCardProps> = ({
  photo,
  index,
  reorderEnabled = true,
  disabled = false,
  selected = false,
  onToggleSelection,
  onPhotoClick,
  onDelete,
  onToggleFeatured,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: photo.id,
    disabled: disabled || !reorderEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleY: 1 } : null,
    ),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  const optimalImage = selectOptimalImage(photo, ImageUseCase.GALLERY, {
    width: 400,
    height: 400,
  });

  const handleClick = () => {
    if (!reorderEnabled && onPhotoClick) {
      onPhotoClick(photo, index);
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      animate={{
        borderColor: reorderEnabled ? "rgb(251 191 36)" : "var(--border)",
        boxShadow: reorderEnabled
          ? "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 0 0 1px rgb(251 191 36 / 0.2)"
          : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card transition-all duration-300",
        isDragging && "shadow-xl ring-2 ring-amber-400",
        selected && "ring-2 ring-primary border-primary bg-primary/5",
        disabled && "opacity-60",
        !reorderEnabled && onPhotoClick && "cursor-pointer",
        reorderEnabled && "border-amber-400/30 bg-amber-50/20",
      )}
      onClick={handleClick}
    >
      <AnimatePresence>
        {reorderEnabled && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: index * 0.03 }}
            {...listeners}
            {...attributes}
            className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full bg-card/95 px-2 py-1 text-xs font-medium text-muted-foreground shadow group-hover:bg-card"
            aria-label="Drag to reorder"
          >
            <GripVertical className="mr-1 h-3 w-3" aria-hidden />
            Drag
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!reorderEnabled && !isDragging && (
          <div className="absolute left-2 top-2 z-10">
            <button
              type="button"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border bg-card/90 backdrop-blur-sm transition-all",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:border-primary",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelection?.(photo.id);
              }}
            >
              {selected && (
                <motion.svg
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </motion.svg>
              )}
            </button>
          </div>
        )}

        {!reorderEnabled && !isDragging && (
          <div
            className={cn(
              "absolute right-2 top-2 z-10 flex gap-1 transition-all duration-300",
              photo.featured
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100",
            )}
          >
            {onToggleFeatured && (
              <Button
                variant="secondary"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full bg-card/90 backdrop-blur-sm shadow-sm hover:bg-card",
                  photo.featured && "text-yellow-500",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFeatured(photo);
                }}
              >
                <Star
                  className={cn("h-4 w-4", photo.featured && "fill-current")}
                />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8 rounded-full bg-destructive/90 backdrop-blur-sm shadow-sm hover:bg-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(photo);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </AnimatePresence>

      <div className="relative aspect-[3/2] w-full overflow-hidden bg-muted">
        <img
          src={optimalImage.url}
          srcSet={optimalImage.srcset}
          sizes={optimalImage.sizes}
          alt={photo.title ?? "Photo"}
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 text-sm font-semibold text-foreground">
            <Move className="mr-2 h-4 w-4" />
            Moving...
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="text-sm font-semibold text-card-foreground">
          <span className="truncate" title={photo.title ?? "Untitled"}>
            {photo.title ?? "Untitled"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {photo.date_taken && (
            <span>{formatDateSimple(photo.date_taken)}</span>
          )}
          <span>Uploaded {formatDateSimple(photo.created_at)}</span>
          {photo.location_name && <span>📍 {photo.location_name}</span>}
        </div>
      </div>
    </motion.div>
  );
};

export default SortablePhotoCard;
