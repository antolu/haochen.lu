import React, { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMove } from "@dnd-kit/sortable";
import SimplePhotoUpload from "../SimplePhotoUpload";
import {
  useProjectImages,
  useAttachProjectImage,
  useRemoveProjectImage,
  useReorderProjectImages,
} from "../../hooks/useProjects";

type ProjectImagesManagerProps = {
  projectId: string;
};

type ProjectImageItemProps = {
  item: any;
  onRemove: (id: string) => void;
};

const SortableItem: React.FC<ProjectImageItemProps> = ({ item, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  const thumbUrl =
    item.photo?.variants?.thumbnail?.url ||
    item.photo?.variants?.small?.url ||
    item.photo?.original_url;
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-center gap-3 py-3"
    >
      <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.alt_text ?? ""}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {item.title || "Untitled image"}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {item.alt_text || ""}
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="inline-flex items-center px-3 py-1 border border-destructive text-sm font-medium rounded-md text-destructive bg-background hover:bg-destructive/10"
      >
        Remove
      </button>
    </li>
  );
};

const ProjectImagesManager: React.FC<ProjectImagesManagerProps> = ({
  projectId,
}) => {
  const { data: images = [], isLoading } = useProjectImages(projectId);
  const attachMutation = useAttachProjectImage(projectId);
  const removeMutation = useRemoveProjectImage(projectId);
  const reorderMutation = useReorderProjectImages(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const itemIds = useMemo(() => images.map((img: any) => img.id), [images]);

  const onUploadComplete = (photo: any) => {
    void attachMutation.mutate({ photo_id: photo.id });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(images, oldIndex, newIndex);
    const items = reordered.map((pi: any, idx: number) => ({
      id: pi.id,
      order: idx,
    }));
    void reorderMutation.mutate({ items, normalize: true });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <h3 className="text-lg font-medium mb-2">Project Images</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Upload multiple images. They are processed into AVIF/WebP/JPEG
          variants automatically.
        </p>
        <SimplePhotoUpload
          maxFiles={10}
          category="projects"
          onComplete={onUploadComplete}
        />
      </div>

      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h4 className="font-medium">Reorder & Manage</h4>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading images…</div>
          ) : images.length === 0 ? (
            <div className="text-sm text-muted-foreground">No images yet.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y">
                  {images.map((img: any) => (
                    <SortableItem
                      key={img.id}
                      item={img}
                      onRemove={(id) => void removeMutation.mutate(id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectImagesManager;
