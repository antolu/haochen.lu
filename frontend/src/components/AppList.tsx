import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Copy, GripVertical, MoreVertical } from "lucide-react";
import type { Application } from "../types";
import { formatDateSimple } from "../utils/dateFormat";
import { applications as applicationsApi } from "../api/client";

interface AppListProps {
  applications: Application[];
  onEdit: (application: Application) => void;
  onDelete: (applicationId: string) => void;
  onToggleEnabled: (applicationId: string, enabled: boolean) => void;
  onOpen: (application: Application) => void;
  onOpenAdmin: (application: Application) => void;
  onReorder: (items: Array<{ id: string; order: number }>) => void;
  isLoading?: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="ml-1 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function OverflowMenu({
  application,
  onEdit,
  onDelete,
  onToggleEnabled,
  onExport,
}: {
  application: Application;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-border bg-popover shadow-lg"
          >
            <div className="py-1">
              <button
                onClick={() => {
                  onEdit();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => {
                  onToggleEnabled();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                {application.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={() => {
                  onExport();
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                Export YAML
              </button>
              <div className="border-t border-border my-1" />
              {confirmDelete ? (
                <div className="px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Delete this app?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        onDelete();
                        setOpen(false);
                        setConfirmDelete(false);
                      }}
                      className="flex-1 px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 px-2 py-1 text-xs font-medium bg-muted hover:bg-muted/80 rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-muted transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortableAppCard({
  application,
  onEdit,
  onDelete,
  onToggleEnabled,
  onOpen,
  onOpenAdmin,
  onExport,
}: {
  application: Application;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: () => void;
  onOpen: () => void;
  onOpenAdmin: () => void;
  onExport: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const icon = application.icon;
  const initial = application.name.charAt(0).toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card rounded-lg border p-4 transition-colors ${
        isDragging
          ? "border-blue-400 shadow-lg"
          : "border-border hover:border-border/60"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-grab active:cursor-grabbing shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-white text-sm font-semibold"
          style={{ backgroundColor: application.color ?? "#3B82F6" }}
        >
          {icon && icon.length <= 2 ? (
            <span className="text-base">{icon}</span>
          ) : icon ? (
            <img src={icon} alt="" className="h-6 w-6 object-contain" />
          ) : (
            initial
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground">
              {application.name}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {application.slug}
            </span>
            {!application.enabled && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                disabled
              </span>
            )}
            {application.admin_only && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                admin only
              </span>
            )}
            {application.requires_auth && !application.admin_only && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                auth
              </span>
            )}
            {!application.requires_auth && application.enabled && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                public
              </span>
            )}
            {!application.show_in_menu && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                hidden
              </span>
            )}
          </div>

          {application.description && (
            <p className="mt-1 text-sm text-muted-foreground truncate">
              {application.description}
            </p>
          )}

          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <a
              href={application.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate max-w-xs"
            >
              {application.url}
            </a>
            <span>·</span>
            <span>{formatDateSimple(application.created_at)}</span>
          </div>

          {application.requires_auth && application.client_id && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs font-mono">
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="text-foreground/50 shrink-0">client_id</span>
                <span className="truncate">{application.client_id}</span>
                <CopyButton value={application.client_id} />
              </div>
              {application.client_secret && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <span className="text-foreground/50 shrink-0">secret</span>
                  <span className="truncate">{application.client_secret}</span>
                  <CopyButton value={application.client_secret} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpen}
            className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 rounded transition-colors"
          >
            Open
          </button>
          {application.admin_url && (
            <button
              onClick={onOpenAdmin}
              className="px-2.5 py-1.5 text-xs font-medium text-violet-700 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900/30 dark:text-violet-400 rounded transition-colors"
            >
              Admin
            </button>
          )}
          <OverflowMenu
            application={application}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleEnabled={onToggleEnabled}
            onExport={onExport}
          />
        </div>
      </div>
    </div>
  );
}

const AppList: React.FC<AppListProps> = ({
  applications,
  onEdit,
  onDelete,
  onToggleEnabled,
  onOpen,
  onOpenAdmin,
  onReorder,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [localApps, setLocalApps] = useState<Application[]>(applications);

  React.useEffect(() => {
    setLocalApps(applications);
  }, [applications]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localApps.findIndex((a) => a.id === active.id);
    const newIndex = localApps.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(localApps, oldIndex, newIndex);
    setLocalApps(reordered);
    onReorder(reordered.map((a, i) => ({ id: a.id, order: i })));
  };

  const handleExport = async (application: Application) => {
    setExportingId(application.id);
    try {
      await applicationsApi.exportYaml(application.id, application.slug);
    } finally {
      setExportingId(null);
    }
  };

  const filtered = searchTerm
    ? localApps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          app.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
          app.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : localApps;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border p-4 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 bg-muted rounded" />
              <div className="h-10 w-10 bg-muted rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Search apps..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {searchTerm
            ? "No apps match your search."
            : "No apps yet. Create your first one!"}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filtered.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {filtered.map((app) => (
                <SortableAppCard
                  key={app.id}
                  application={app}
                  onEdit={() => onEdit(app)}
                  onDelete={() => onDelete(app.id)}
                  onToggleEnabled={() => onToggleEnabled(app.id, !app.enabled)}
                  onOpen={() => onOpen(app)}
                  onOpenAdmin={() => onOpenAdmin(app)}
                  onExport={() => {
                    void handleExport(app);
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      {exportingId && <span className="sr-only">Exporting...</span>}
    </div>
  );
};

export default AppList;
