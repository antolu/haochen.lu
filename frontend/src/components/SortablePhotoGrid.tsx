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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Photo } from "../types";
import { cn } from "../lib/utils";
import SortablePhotoCard from "./SortablePhotoItem";

interface SortablePhotoGridProps {
  photos: Photo[];
  onReorder: (photos: Photo[]) => void;
  disabled?: boolean;
}

const SortablePhotoGrid: React.FC<SortablePhotoGridProps> = ({
  photos,
  onReorder,
  disabled = false,
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
    if (disabled) {
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

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div
          className={cn(
            "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
            disabled && "opacity-60",
          )}
        >
          {photos.map((photo) => (
            <SortablePhotoCard
              key={photo.id}
              photo={photo}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default SortablePhotoGrid;
