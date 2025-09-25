import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Move } from "lucide-react";
import type { Photo } from "../types";
import { cn } from "../lib/utils";
import { formatDateSimple } from "../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";

interface SortablePhotoCardProps {
  photo: Photo;
  index: number;
  reorderEnabled?: boolean;
  disabled?: boolean;
  onPhotoClick?: (photo: Photo, index: number) => void;
}

const SortablePhotoCard: React.FC<SortablePhotoCardProps> = ({
  photo,
  index,
  reorderEnabled = true,
  disabled = false,
  onPhotoClick,
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
        borderColor: reorderEnabled ? "rgb(251 191 36)" : "rgb(229 231 235)", // amber-400 : gray-200
        boxShadow: reorderEnabled
          ? "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 0 0 1px rgb(251 191 36 / 0.2)"
          : "0 1px 2px 0 rgb(0 0 0 / 0.05)",
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-white transition-all duration-300",
        isDragging && "shadow-xl ring-2 ring-amber-400",
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
            className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-gray-600 shadow group-hover:bg-white"
            aria-label="Drag to reorder"
          >
            <GripVertical className="mr-1 h-3 w-3" aria-hidden />
            Drag
          </motion.button>
        )}
      </AnimatePresence>
      <div className="relative h-48 w-full overflow-hidden bg-gray-100">
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
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 text-sm font-semibold text-gray-700">
            <Move className="mr-2 h-4 w-4" />
            Moving...
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="text-sm font-semibold text-gray-900">
          <span className="truncate" title={photo.title ?? "Untitled"}>
            {photo.title ?? "Untitled"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
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
