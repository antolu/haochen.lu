import React, { useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Star,
  Edit3,
  Trash2,
  Calendar,
  Camera,
} from "lucide-react";

import type { Photo } from "../../types";
import { formatDateSimple } from "../../utils/dateFormat";
import { selectOptimalImage, ImageUseCase } from "../../utils/imageUtils";
import { cn } from "../../lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Badge } from "../ui/badge";

interface SortablePhotoListProps {
  photos: Photo[];
  reorderEnabled: boolean;
  onReorder: (ordered: Photo[]) => void;
  onEdit: (photo: Photo) => void;
  onToggleFeatured: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  isLoading?: boolean;
}

const SortablePhotoList: React.FC<SortablePhotoListProps> = ({
  photos,
  reorderEnabled,
  onReorder,
  onEdit,
  onToggleFeatured,
  onDelete,
  isLoading = false,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
  );

  const items = useMemo(() => photos.map((photo) => photo.id), [photos]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderEnabled) {
      return;
    }
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = photos.findIndex((photo) => photo.id === active.id);
    const newIndex = photos.findIndex((photo) => photo.id === over.id);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(photos, oldIndex, newIndex);
    onReorder(reordered);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading photos...
      </div>
    );
  }

  if (!photos.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No photos found.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead
                  className="w-12"
                  aria-label="Reorder handle"
                ></TableHead>
                <TableHead className="w-24">Photo</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-[220px]">Details</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {photos.map((photo) => (
                <SortableRow
                  key={photo.id}
                  photo={photo}
                  reorderEnabled={reorderEnabled}
                  onEdit={onEdit}
                  onToggleFeatured={onToggleFeatured}
                  onDelete={onDelete}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </SortableContext>
    </DndContext>
  );
};

interface SortableRowProps {
  photo: Photo;
  reorderEnabled: boolean;
  onEdit: (photo: Photo) => void;
  onToggleFeatured: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  photo,
  reorderEnabled,
  onEdit,
  onToggleFeatured,
  onDelete,
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
    disabled: !reorderEnabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "group",
        reorderEnabled ? "cursor-move" : "cursor-pointer",
        isDragging && "bg-amber-50",
      )}
      onClick={() => {
        if (!reorderEnabled) {
          onEdit(photo);
        }
      }}
    >
      <TableCell className="w-12">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className={cn(
            "mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-500 transition",
            reorderEnabled
              ? "hover:border-amber-400 hover:text-amber-500"
              : "opacity-0 group-hover:opacity-100",
            !reorderEnabled && "cursor-default",
          )}
          disabled={!reorderEnabled}
          aria-label="Drag to reorder"
          onClick={(event) => {
            if (!reorderEnabled) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="w-24">
        <div className="relative h-14 w-20 overflow-hidden rounded-md">
          <img
            src={selectOptimalImage(photo, ImageUseCase.THUMBNAIL).url}
            alt={photo.title || "Photo"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {photo.featured && (
            <span className="absolute top-1 right-1 inline-flex items-center rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700 shadow">
              Featured
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium text-gray-900">
            {photo.title || "Untitled"}
          </div>
          {photo.description && (
            <div className="line-clamp-2 text-xs text-gray-500">
              {photo.description}
            </div>
          )}
          <div className="text-[11px] text-gray-400">Order #{photo.order}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs text-gray-500">
          {photo.date_taken && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateSimple(photo.date_taken)}
            </div>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Uploaded {formatDateSimple(photo.created_at)}
          </div>
          {photo.camera_make && (
            <div className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {photo.camera_make} {photo.camera_model}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {photo.featured && (
            <Badge className="bg-yellow-100 text-yellow-800">Featured</Badge>
          )}
          {photo.category && (
            <Badge variant="outline" className="text-xs">
              {photo.category}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleFeatured(photo);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-yellow-600"
            aria-label={
              photo.featured ? "Remove from featured" : "Mark as featured"
            }
          >
            <Star
              className={cn(
                "h-4 w-4",
                photo.featured && "fill-current text-yellow-500",
              )}
            />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(photo);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-blue-600"
            aria-label="Edit photo"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(photo);
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100"
            aria-label="Delete photo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
};

export default SortablePhotoList;
