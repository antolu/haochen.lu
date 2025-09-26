import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Edit3, Trash2, ExternalLink } from "lucide-react";
import type { Project } from "../../hooks/useProjects";
import { cn } from "../../lib/utils";

interface SortableProjectListProps {
  projects: Project[];
  reorderEnabled: boolean;
  onReorder: (ordered: Project[]) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  isLoading?: boolean;
}

const SortableProjectList: React.FC<SortableProjectListProps> = ({
  projects,
  reorderEnabled,
  onReorder,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const items = useMemo(() => projects.map((p) => p.id), [projects]);

  const handleDragEnd = (event: DragEndEvent) => {
    if (!reorderEnabled) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = projects.findIndex((p) => p.id === active.id);
    const newIndex = projects.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(projects, oldIndex, newIndex);
    onReorder(reordered);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading projects...
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No projects found.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        <div className="divide-y">
          {projects.map((project, index) => (
            <SortableRow
              key={project.id}
              project={project}
              index={index}
              reorderEnabled={reorderEnabled}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};

interface RowProps {
  project: Project;
  index: number;
  reorderEnabled: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const SortableRow: React.FC<RowProps> = ({
  project,
  index,
  reorderEnabled,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id, disabled: !reorderEnabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: reorderEnabled ? 10 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn(
        "p-4 sm:p-6 hover:bg-muted/50 transition-colors flex items-center justify-between",
        reorderEnabled ? "cursor-move" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <button
          type="button"
          {...listeners}
          {...attributes}
          className={cn(
            "hidden sm:flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-muted-foreground",
            reorderEnabled ? "" : "opacity-50",
          )}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-shrink-0">
          {project.cover_image_url ? (
            <img
              src={project.cover_image_url}
              alt={project.title}
              className="w-14 h-14 rounded-lg object-cover"
            />
          ) : (
            <div className="w-14 h-14 bg-muted rounded-lg" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-medium truncate">{project.title}</h4>
            {project.featured && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Featured
              </span>
            )}
          </div>
          {project.short_description && (
            <p className="text-sm text-muted-foreground truncate">
              {project.short_description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {project.demo_url && (
          <a
            href={project.demo_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <Edit3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(project)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default SortableProjectList;
