import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Move } from "lucide-react";
import type { Photo } from "../types";
import { cn } from "../lib/utils";
import { formatDateSimple } from "../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../utils/imageUtils";

interface SortablePhotoCardProps {
  photo: Photo;
  disabled?: boolean;
}

const SortablePhotoCard: React.FC<SortablePhotoCardProps> = ({
  photo,
  disabled = false,
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
    disabled,
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow",
        isDragging && "shadow-xl ring-2 ring-amber-400",
        disabled && "opacity-60",
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="absolute right-2 top-2 z-10 inline-flex items-center rounded-full bg-white/95 px-2 py-1 text-xs font-medium text-gray-600 shadow group-hover:bg-white"
        aria-label="Drag to reorder"
      >
        <GripVertical className="mr-1 h-3 w-3" aria-hidden />
        Drag
      </button>
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
        <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
          <span className="truncate" title={photo.title ?? "Untitled"}>
            {photo.title ?? "Untitled"}
          </span>
          <span className="text-xs font-medium text-gray-500">
            #{photo.order}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          {photo.date_taken && (
            <span>{formatDateSimple(photo.date_taken)}</span>
          )}
          <span>Uploaded {formatDateSimple(photo.created_at)}</span>
          {photo.location_name && <span>📍 {photo.location_name}</span>}
        </div>
        <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
          <p>
            Order value: <strong>{photo.order}</strong>
          </p>
          <p className="text-[11px] text-gray-400">
            Auto-updated when reordering
          </p>
        </div>
      </div>
    </div>
  );
};

export default SortablePhotoCard;
