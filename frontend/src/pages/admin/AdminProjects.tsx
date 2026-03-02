import React, { useState } from "react";
import {
  useProjects,
  useDeleteProject,
  useProjectStats,
  type Project,
  useReorderProjects,
} from "../../hooks/useProjects";
import SortableProjectList from "../../components/admin/SortableProjectList";
import ProjectForm from "../../components/ProjectForm";
import StatCard from "../../components/admin/StatCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Plus, Briefcase, Star, TrendingUp } from "lucide-react";

type ViewMode = "list" | "create" | "edit";

const AdminProjects: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [reorderEnabled, setReorderEnabled] = useState(false);

  const {
    data: projectsData,
    isLoading,
    error,
  } = useProjects({
    search: searchQuery.trim() === "" ? undefined : searchQuery,
    status: ((): "active" | "archived" | "in_progress" | undefined => {
      if (
        statusFilter === "" ||
        statusFilter === undefined ||
        statusFilter === "all"
      )
        return undefined;
      if (
        statusFilter === "active" ||
        statusFilter === "archived" ||
        statusFilter === "in_progress"
      ) {
        return statusFilter;
      }
      return undefined;
    })(),
  });
  const { data: stats } = useProjectStats();
  const reorderMutation = useReorderProjects();
  const deleteMutation = useDeleteProject();

  const projects = projectsData?.projects ?? [];
  const handleReorder = async (ordered: Project[]) => {
    if (!ordered.length) return;
    const items = ordered.map((p, idx) => ({ id: p.id, order: idx + 1 }));
    try {
      await reorderMutation.mutateAsync({ items, normalize: true });
    } catch {
      // error toast handled in hook
    }
  };

  const handleCreateProject = () => {
    setEditingProject(null);
    setViewMode("create");
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setViewMode("edit");
  };

  const handleDeleteProject = async (project: Project) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${project.title}"? This action cannot be undone.`,
      )
    ) {
      try {
        await deleteMutation.mutateAsync(project.id);
      } catch (error) {
        console.error("Failed to delete project:", error);
      }
    }
  };

  const handleFormSuccess = () => {
    setViewMode("list");
    setEditingProject(null);
  };

  const handleFormCancel = () => {
    setViewMode("list");
    setEditingProject(null);
  };

  if (viewMode === "create" || viewMode === "edit") {
    return (
      <div>
        <ProjectForm
          project={editingProject ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="admin-page-title">Project Management</h1>
            <p className="text-muted-foreground text-xl">
              Create and manage your project portfolio
            </p>
          </div>
          <Button variant="gradient" size="lg" onClick={handleCreateProject}>
            <Plus className="w-5 h-5 mr-2" />
            New Project
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Projects"
              value={stats.total_projects}
              gradient="from-primary/10 to-primary/20"
              iconBg="bg-primary/10 dark:bg-primary/20"
              icon={<Briefcase className="w-5 h-5 text-primary" />}
            />
            <StatCard
              title="Featured"
              value={stats.featured_projects}
              gradient="from-yellow-500/20 to-yellow-600/20"
              iconBg="bg-yellow-50/50 dark:bg-yellow-950/20"
              icon={
                <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              }
            />
            <StatCard
              title="Active"
              value={projects.filter((p) => p.status === "active").length}
              gradient="from-green-500/20 to-green-600/20"
              iconBg="bg-green-50/50 dark:bg-green-950/20"
              icon={
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              }
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 bg-muted/30 p-6 rounded-xl">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Status Filter & Reorder toggle */}
          <div className="flex items-center gap-3">
            <Select
              value={statusFilter || undefined}
              onValueChange={(value) => setStatusFilter(value || "")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <label className="text-sm text-muted-foreground flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={reorderEnabled}
                onChange={(e) => setReorderEnabled(e.target.checked)}
                className="cursor-pointer"
              />
              Reorder
            </label>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-card rounded-xl shadow-lg border-border/40 overflow-hidden">
        {isLoading ? (
          <ProjectListSkeleton />
        ) : error ? (
          <div className="p-8 text-center">
            <div className="text-destructive mb-2">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">
              Failed to load projects
            </h3>
            <p className="text-muted-foreground">
              There was an error loading your projects. Please try again.
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-muted-foreground mb-4">
              <svg
                className="w-12 h-12 mx-auto"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || statusFilter
                ? "Try adjusting your search or filters."
                : "Get started by creating your first project."}
            </p>
            {!searchQuery && !statusFilter && (
              <Button onClick={handleCreateProject}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        ) : (
          <SortableProjectList
            projects={projects}
            reorderEnabled={reorderEnabled}
            onReorder={(p) => void handleReorder(p)}
            onEdit={(p) => handleEditProject(p)}
            onDelete={(p) => void handleDeleteProject(p)}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

// Project list item component (legacy; no longer used) - removed to fix parsing errors

// Loading skeleton
const ProjectListSkeleton: React.FC = () => {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="p-6 animate-pulse">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-muted rounded-lg"></div>
            <div className="flex-1 min-w-0">
              <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-muted rounded w-2/3 mb-2"></div>
              <div className="flex gap-2">
                <div className="h-5 w-16 bg-muted rounded"></div>
                <div className="h-5 w-20 bg-muted rounded"></div>
                <div className="h-5 w-14 bg-muted rounded"></div>
              </div>
            </div>
            <div className="flex space-x-2">
              <div className="h-8 w-16 bg-muted rounded"></div>
              <div className="h-8 w-12 bg-muted rounded"></div>
              <div className="h-8 w-16 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AdminProjects;
