import React, { useMemo, useState } from "react";
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
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
//
import {
  useProjectImages,
  useAttachProjectImage,
  useRemoveProjectImage,
  useReorderProjectImages,
  useUpdateProjectImage,
} from "../../hooks/useProjects";
import PhotoDropzone, { type UploadFile } from "../PhotoDropzone";
import { ImageCropperModal } from "./ImageCropperModal";

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
  isEditing: boolean;
  onEdit: () => void;
  onSave: (title: string, altText: string) => Promise<void>;
  onCancel: () => void;
};

const SortableItem: React.FC<ProjectImageItemProps> = ({
  item,
  onRemove,
  isEditing,
  onEdit,
  onSave,
  onCancel,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: item.id,
      disabled: isEditing,
    });
  const [tempTitle, setTempTitle] = React.useState(item.title ?? "");
  const [tempAlt, setTempAlt] = React.useState(item.alt_text ?? "");

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  } as React.CSSProperties;
  const thumbUrl =
    item.photo?.variants?.thumbnail?.url ??
    item.photo?.variants?.small?.url ??
    item.photo?.original_url;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center gap-3 py-3 ${isEditing ? "bg-muted/20" : ""}`}
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
      <div className="flex-1 min-w-0 space-y-1">
        {isEditing ? (
          <div className="space-y-2 pr-4">
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              placeholder="Title"
              className="w-full text-sm font-medium bg-background border rounded px-2 py-1"
              autoFocus
            />
            <input
              type="text"
              value={tempAlt}
              onChange={(e) => setTempAlt(e.target.value)}
              placeholder="Alt text"
              className="w-full text-xs bg-background border rounded px-2 py-1"
            />
          </div>
        ) : (
          <>
            <div className="text-sm font-medium truncate">
              {item.title ?? "Untitled image"}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {item.alt_text ?? ""}
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void onSave(tempTitle, tempAlt);
              }}
              className="inline-flex items-center px-3 py-1 border border-primary text-sm font-medium rounded-md text-primary bg-background hover:bg-primary/10"
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              className="inline-flex items-center px-3 py-1 border border-border text-sm font-medium rounded-md text-muted-foreground bg-background hover:bg-muted"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
              }}
              className="inline-flex items-center px-3 py-1 border border-border text-sm font-medium rounded-md text-foreground bg-background hover:bg-muted"
            >
              Edit
            </button>
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
          </>
        )}
      </div>
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
  const updateMutation = useUpdateProjectImage(projectId);

  const [editingId, setEditingId] = React.useState<string | null>(null);

  // Cropper state
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const typedImages = useMemo(
    () => (images as unknown as ProjectImage[]) ?? [],
    [images],
  );
  const itemIds = useMemo(
    () => typedImages.map((img) => img.id),
    [typedImages],
  );

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

  const handleFilesAdded = (files: UploadFile[]) => {
    const file = files.find((f) => f.file)?.file;
    if (file) {
      setCropFile(file);
      setIsCropperOpen(true);
    }
  };

  const handleCrop = async (croppedFile: File) => {
    setIsUploading(true);
    try {
      // Use the original filename to create a better default title
      let title = "Project Image";
      if (cropFile) {
        const baseName = cropFile.name.replace(/\.[^/.]+$/, "");
        // Clean up dashes/underscores and capitalize words
        title = baseName
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
      }

      await attachMutation.mutateAsync({
        file: croppedFile,
        title,
      });
      void refetch();
    } catch (error) {
      console.error("Failed to upload cropped image:", error);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
      setCropFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-3">
          Upload and crop images to a 16:9 aspect ratio.
        </p>

        {isUploading ? (
          <div className="flex items-center justify-center p-8 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">
                Uploading image...
              </p>
            </div>
          </div>
        ) : (
          <PhotoDropzone
            onFilesAdded={handleFilesAdded}
            maxFiles={1}
            maxFileSize={50 * 1024 * 1024}
            accept={{ "image/*": [".jpeg", ".jpg", ".png", ".webp", ".avif"] }}
          />
        )}
      </div>

      <ImageCropperModal
        key={
          cropFile ? `crop-${cropFile.name}-${cropFile.lastModified}` : "closed"
        }
        isOpen={isCropperOpen}
        onClose={() => {
          setIsCropperOpen(false);
          setCropFile(null);
        }}
        file={cropFile}
        aspectRatio={16 / 9}
        onCrop={handleCrop}
      />

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
                      isEditing={editingId === img.id}
                      onEdit={() => setEditingId(img.id)}
                      onCancel={() => setEditingId(null)}
                      onSave={async (title, altText) => {
                        await updateMutation.mutateAsync({
                          projectImageId: img.id,
                          title,
                          alt_text: altText,
                        });
                        setEditingId(null);
                      }}
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
