import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, projects as projectsApi } from "../api/client";
import type { ProjectStatsSummary } from "../types";

interface ProjectReadmeResponse {
  content: string;
  last_updated?: string;
  source?: string;
}

interface ProjectPreviewResponse {
  content: string;
  repo_url: string;
  raw_url?: string;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  github_url?: string;
  demo_url?: string;
  image_url?: string;
  technologies?: string;
  featured: boolean;
  status: "active" | "archived" | "in_progress";
  created_at: string;
  updated_at: string;
  // Repository integration fields
  repository_type?: string;
  repository_owner?: string;
  repository_name?: string;
  use_readme?: boolean;
  readme_content?: string;
  readme_last_updated?: string;
}

export interface ProjectFilters {
  featured?: boolean;
  status?: "active" | "archived" | "in_progress";
  technologies?: string[];
  category?: string;
  search?: string;
  order_by?: "order" | "created_at" | "updated_at";
}

export interface ProjectCreate {
  title: string;
  slug?: string;
  description: string;
  short_description?: string;
  github_url?: string;
  demo_url?: string;
  image_url?: string;
  technologies?: string;
  featured?: boolean;
  status?: "active" | "archived" | "in_progress";
  repository_type?: string;
  repository_owner?: string;
  repository_name?: string;
  use_readme?: boolean;
}

export interface ProjectUpdate {
  title?: string;
  description?: string;
  short_description?: string;
  github_url?: string;
  demo_url?: string;
  image_url?: string;
  technologies?: string;
  featured?: boolean;
  status?: "active" | "archived" | "in_progress";
  repository_type?: string;
  repository_owner?: string;
  repository_name?: string;
  use_readme?: boolean;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page?: number;
  per_page?: number;
  pages?: number;
}

// Query key factory for consistent cache management
export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: ProjectFilters) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (idOrSlug: string) => [...projectKeys.details(), idOrSlug] as const,
  featured: () => [...projectKeys.all, "featured"] as const,
  readme: (projectId: string) =>
    [...projectKeys.all, "readme", projectId] as const,
  stats: () => [...projectKeys.all, "stats"] as const,
};

// Hooks for project data management

/**
 * Hook for fetching projects with filtering and pagination
 */
export function useProjects(filters: ProjectFilters = {}) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.featured !== undefined) {
        params.append("featured_only", filters.featured.toString());
      }
      if (filters.status) {
        params.append("status", filters.status);
      }
      if (filters.search) {
        params.append("search", filters.search);
      }

      if (filters.order_by) {
        params.append("order_by", filters.order_by);
      }
      const response = await apiClient.get(`/projects?${params.toString()}`);
      return response.data as ProjectListResponse;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for infinite scroll project loading
 */
export function useInfiniteProjects(filters: ProjectFilters = {}) {
  return useInfiniteQuery({
    queryKey: [...projectKeys.list(filters), "infinite"],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.append("page", pageParam.toString());
      params.append("per_page", "12");

      if (filters.featured !== undefined) {
        params.append("featured_only", filters.featured.toString());
      }
      if (filters.status) {
        params.append("status", filters.status);
      }
      if (filters.search) {
        params.append("search", filters.search);
      }

      if (filters.order_by) {
        params.append("order_by", filters.order_by);
      }
      const response = await apiClient.get(`/projects?${params.toString()}`);
      return response.data as ProjectListResponse;
    },
    getNextPageParam: (lastPage, allPages) => {
      const nextPage = allPages.length + 1;
      return lastPage.projects.length === 12 ? nextPage : undefined;
    },
    staleTime: 5 * 60 * 1000,
    initialPageParam: 1,
  });
}

/**
 * Hook for fetching a single project by ID or slug
 */
export function useProject(idOrSlug: string) {
  return useQuery({
    queryKey: projectKeys.detail(idOrSlug),
    queryFn: async () => {
      const response = await apiClient.get(`/projects/${idOrSlug}`);
      return response.data as Project;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!idOrSlug,
  });
}

/**
 * Hook for fetching featured projects
 */
export function useFeaturedProjects() {
  return useQuery({
    queryKey: projectKeys.featured(),
    queryFn: async () => {
      const response = await apiClient.get("/projects/featured");
      return response.data as Project[];
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook for fetching project README content
 */
export function useProjectReadme(projectId: string, repoUrl?: string) {
  return useQuery<ProjectReadmeResponse>({
    queryKey: projectKeys.readme(projectId),
    queryFn: async (): Promise<ProjectReadmeResponse> => {
      // First check if we have cached README
      try {
        const response = await apiClient.get<ProjectReadmeResponse>(
          `/projects/${projectId}/readme`,
        );
        return response.data;
      } catch (error) {
        // If no cached README and we have a repo URL, try to fetch
        if (repoUrl) {
          const fetchResponse = await apiClient.post<ProjectReadmeResponse>(
            `/projects/${projectId}/fetch-readme`,
            {
              repo_url: repoUrl,
            },
          );
          return fetchResponse.data;
        }
        throw error;
      }
    },
    enabled: !!projectId && !!repoUrl,
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1, // Only retry once for README fetching
  });
}

/**
 * Hook for project statistics (admin only)
 */
export function useProjectStats() {
  return useQuery<ProjectStatsSummary>({
    queryKey: projectKeys.stats(),
    queryFn: async () => {
      const response = await apiClient.get<ProjectStatsSummary>(
        "/projects/stats/summary",
      );
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectTechnologies() {
  return useQuery({
    queryKey: [...projectKeys.all, "technologies"],
    queryFn: () => projectsApi.getTechnologies(),
    staleTime: 5 * 60 * 1000,
  });
}

// Mutation hooks for project management

/**
 * Hook for creating a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectData: ProjectCreate) => {
      const response = await apiClient.post("/projects", projectData);
      return response.data as Project;
    },
    onSuccess: (newProject) => {
      // Invalidate and refetch project lists
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.featured() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.stats() });

      // Set the new project in the cache
      queryClient.setQueryData(projectKeys.detail(newProject.id), newProject);
      queryClient.setQueryData(projectKeys.detail(newProject.slug), newProject);
    },
  });
}

/**
 * Hook for updating a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProjectUpdate }) => {
      const response = await apiClient.put(`/projects/${id}`, data);
      return response.data as Project;
    },
    onSuccess: (updatedProject) => {
      // Update the project in all relevant caches
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.id),
        updatedProject,
      );
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.slug),
        updatedProject,
      );

      // Invalidate lists to reflect changes
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.featured() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.stats() });
    },
  });
}

/**
 * Hook for deleting a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: (_, deletedId) => {
      // Remove the project from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) });

      // Invalidate all lists
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.featured() });
      void queryClient.invalidateQueries({ queryKey: projectKeys.stats() });
    },
  });
}

/**
 * Hook for fetching README preview (admin use)
 */
export function usePreviewReadme() {
  return useMutation<ProjectPreviewResponse, Error, string>({
    mutationFn: async (repoUrl: string): Promise<ProjectPreviewResponse> => {
      const response = await apiClient.post<ProjectPreviewResponse>(
        "/projects/preview-readme",
        {
          repo_url: repoUrl,
        },
      );
      return response.data;
    },
  });
}

/**
 * Hook for refreshing README content
 */
export function useRefreshReadme() {
  const queryClient = useQueryClient();

  return useMutation<
    ProjectReadmeResponse,
    Error,
    { projectId: string; repoUrl: string }
  >({
    mutationFn: async ({
      projectId,
      repoUrl,
    }: {
      projectId: string;
      repoUrl: string;
    }): Promise<ProjectReadmeResponse> => {
      const response = await apiClient.post<ProjectReadmeResponse>(
        `/projects/${projectId}/refresh-readme`,
        {
          repo_url: repoUrl,
        },
      );
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      // Invalidate README cache to force refetch
      void queryClient.invalidateQueries({
        queryKey: projectKeys.readme(projectId),
      });
    },
  });
}

// Utility functions

/**
 * Parse technologies string into array
 */
export function parseTechnologies(technologies?: string): string[] {
  if (!technologies) return [];
  try {
    return JSON.parse(technologies) as string[];
  } catch {
    // Fallback to comma-separated parsing
    return technologies
      .split(",")
      .map((tech) => tech.trim())
      .filter(Boolean);
  }
}

/**
 * Format technologies array into string
 */
export function formatTechnologies(technologies: string[]): string {
  return JSON.stringify(technologies);
}

/**
 * Extract repository info from URL
 */
export function parseRepositoryUrl(url: string): {
  type: "github" | "gitlab" | "unknown";
  owner: string;
  repo: string;
} | null {
  try {
    const urlObj = new URL(url);
    if (!(urlObj.protocol === "http:" || urlObj.protocol === "https:")) {
      return null;
    }
    const pathname = urlObj.pathname.replace(/^\//, "").replace(/\/$/, "");
    const parts = pathname.split("/");

    if (
      urlObj.hostname === "github.com" &&
      parts.length >= 2 &&
      parts[0] &&
      parts[1]
    ) {
      return {
        type: "github",
        owner: parts[0],
        repo: parts[1],
      };
    }

    if (
      urlObj.hostname.includes("gitlab") &&
      parts.length >= 2 &&
      parts[0] &&
      parts[1]
    ) {
      return {
        type: "gitlab",
        owner: parts[0],
        repo: parts[1],
      };
    }

    // Unknown git servers: return owner/repo when present
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return {
        type: "unknown",
        owner: parts[0],
        repo: parts[1],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim()
    .replace(/^-/g, "")
    .replace(/-$/g, "");
}
