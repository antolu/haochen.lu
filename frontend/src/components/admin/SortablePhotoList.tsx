import React, { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Menu,
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
  viewMode: "grid" | "list";
  onReorder: (ordered: Photo[]) => void;
  onEdit: (photo: Photo) => void;
  onToggleFeatured: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
  isLoading?: boolean;
}

const SortablePhotoList: React.FC<SortablePhotoListProps> = ({
  photos,
  reorderEnabled,
  viewMode,
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
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted">
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
              {photos.map((photo, index) => (
                <SortableRow
                  key={photo.id}
                  photo={photo}
                  index={index}
                  reorderEnabled={reorderEnabled}
                  viewMode={viewMode}
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
  index: number;
  reorderEnabled: boolean;
  viewMode: "grid" | "list";
  onEdit: (photo: Photo) => void;
  onToggleFeatured: (photo: Photo) => void;
  onDelete: (photo: Photo) => void;
}

const SortableRow: React.FC<SortableRowProps> = ({
  photo,
  index,
  reorderEnabled,
  viewMode,
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
    <motion.tr
      ref={setNodeRef}
      style={style}
      animate={{
        backgroundColor: reorderEnabled ? "rgb(255 251 235)" : undefined,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "group border-b border-border transition-colors",
        reorderEnabled ? "cursor-move" : "cursor-pointer",
        isDragging && "bg-amber-100 shadow-sm",
      )}
      onClick={() => {
        if (!reorderEnabled) {
          onEdit(photo);
        }
      }}
    >
      <TableCell className="w-12">
        <AnimatePresence>
          {reorderEnabled && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -10 }}
              transition={{
                duration: 0.2,
                ease: "easeOut",
                delay: index * 0.02,
              }}
              {...listeners}
              {...attributes}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition hover:border-amber-400 hover:text-amber-500"
              aria-label="Drag to reorder"
            >
              {viewMode === "list" ? (
                <Menu className="h-4 w-4" />
              ) : (
                <GripVertical className="h-4 w-4" />
              )}
            </motion.button>
          )}
        </AnimatePresence>
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
          <div className="font-medium">{photo.title || "Untitled"}</div>
          {photo.description && (
            <div className="line-clamp-2 text-xs text-muted-foreground">
              {photo.description}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 text-xs text-muted-foreground">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-yellow-600"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-blue-600"
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition hover:bg-red-100 dark:hover:bg-red-900/30"
            aria-label="Delete photo"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </TableCell>
    </motion.tr>
  );
};

export default SortablePhotoList;
