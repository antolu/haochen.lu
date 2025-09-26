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
//
import {
  useProjectImages,
  useAttachProjectImage,
  useRemoveProjectImage,
  useReorderProjectImages,
} from "../../hooks/useProjects";

type ProjectImage = {
  id: string;
  title?: string | null;
  alt_text?: string | null;
  photo?: {
    variants?: Record<string, { url?: string }>;
    original_url?: string;
  };
};

type ProjectImagesManagerProps = {
  projectId: string;
};

type ProjectImageItemProps = {
  item: ProjectImage;
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
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove(item.id);
        }}
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
  const { data: images = [], isLoading, refetch } = useProjectImages(projectId);
  const attachMutation = useAttachProjectImage(projectId);
  const removeMutation = useRemoveProjectImage(projectId);
  const reorderMutation = useReorderProjectImages(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const typedImages = (images as unknown as ProjectImage[]) ?? [];
  const itemIds = useMemo(
    () => typedImages.map((img) => img.id),
    [typedImages],
  );

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    Array.from(files)
      .slice(0, 10)
      .forEach((file) => {
        void attachMutation.mutate({ file });
      });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(typedImages, oldIndex, newIndex);
    const items = reordered.map((pi, idx: number) => ({
      id: pi.id,
      order: idx,
    }));
    void reorderMutation.mutate({ items, normalize: true });
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Upload multiple images. They are processed into AVIF/WebP/JPEG
          variants automatically.
        </p>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              handleFilesSelected(e.currentTarget.files);
              e.currentTarget.value = ""; // allow re-selecting same files
              void refetch();
            }}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border file:text-sm file:font-semibold file:bg-background file:text-foreground hover:file:bg-accent"
          />
        </div>
      </div>

      <div className="bg-card border rounded-lg">
        <div className="p-4 border-b">
          <h4 className="font-medium">Reorder & Manage</h4>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading images…</div>
          ) : typedImages.length === 0 ? (
            <div className="text-sm text-muted-foreground">No images yet.</div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                <ul className="divide-y">
                  {typedImages.map((img) => (
                    <SortableItem
                      key={img.id}
                      item={img}
                      onRemove={(id) => {
                        void removeMutation.mutate(id, {
                          onSuccess: () => void refetch(),
                        });
                      }}
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
