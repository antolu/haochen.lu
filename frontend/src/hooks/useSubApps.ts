import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subapps } from "../api/client";
import type { SubApp, SubAppListResponse, SubAppStatsSummary } from "../types";
import toast from "react-hot-toast";
import type { AxiosError } from "axios";

// Query Keys
export const subappKeys = {
  all: ["subapps"] as const,
  lists: () => [...subappKeys.all, "list"] as const,
  list: (filters: string) => [...subappKeys.lists(), { filters }] as const,
  details: () => [...subappKeys.all, "detail"] as const,
  detail: (id: string) => [...subappKeys.details(), id] as const,
  stats: () => [...subappKeys.all, "stats"] as const,
};

// Hook to get all sub-apps (admin view)
export const useSubApps = () => {
  return useQuery({
    queryKey: subappKeys.list("admin"),
    queryFn: () => subapps.listAll(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: SubAppListResponse) => ({
      ...data,
      subapps: data.subapps.sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name),
      ),
    }),
  });
};

// Hook to get a single sub-app
export const useSubApp = (identifier: string, enabled = true) => {
  return useQuery({
    queryKey: subappKeys.detail(identifier),
    queryFn: () => subapps.getByIdOrSlug(identifier),
    enabled: enabled && !!identifier,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to get sub-app statistics
export const useSubAppStats = () => {
  return useQuery<SubAppStatsSummary>({
    queryKey: subappKeys.stats(),
    queryFn: () => subapps.getStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

// Hook to create a new sub-app
export const useCreateSubApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<SubApp, "id" | "slug" | "created_at" | "updated_at">,
    ) => subapps.create(data),
    onSuccess: (newSubApp) => {
      // Invalidate and refetch sub-apps list
      void queryClient.invalidateQueries({ queryKey: subappKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: subappKeys.stats() });

      // Add the new sub-app to the cache
      queryClient.setQueryData(subappKeys.detail(newSubApp.id), newSubApp);

      toast.success(`Sub-app "${newSubApp.name}" created successfully!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error.response?.data?.detail ?? "Failed to create sub-app";
      toast.error(message);
    },
  });
};

// Hook to update a sub-app
export const useUpdateSubApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SubApp> }) =>
      subapps.update(id, data),
    onSuccess: (updatedSubApp) => {
      // Update the sub-app in the list cache
      queryClient.setQueryData(
        subappKeys.list("admin"),
        (old: SubAppListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            subapps: old.subapps.map((subapp) =>
              subapp.id === updatedSubApp.id ? updatedSubApp : subapp,
            ),
          };
        },
      );

      // Update the individual sub-app cache
      queryClient.setQueryData(
        subappKeys.detail(updatedSubApp.id),
        updatedSubApp,
      );
      queryClient.setQueryData(
        subappKeys.detail(updatedSubApp.slug),
        updatedSubApp,
      );

      // Invalidate stats
      void queryClient.invalidateQueries({ queryKey: subappKeys.stats() });

      toast.success(`Sub-app "${updatedSubApp.name}" updated successfully!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error.response?.data?.detail ?? "Failed to update sub-app";
      toast.error(message);
    },
  });
};

// Hook to delete a sub-app
export const useDeleteSubApp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => subapps.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove the sub-app from the list cache
      queryClient.setQueryData(
        subappKeys.list("admin"),
        (old: SubAppListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            subapps: old.subapps.filter((subapp) => subapp.id !== deletedId),
            total: old.total - 1,
          };
        },
      );

      // Remove from detail caches
      queryClient.removeQueries({ queryKey: subappKeys.detail(deletedId) });

      // Invalidate stats
      void queryClient.invalidateQueries({ queryKey: subappKeys.stats() });

      toast.success("Sub-app deleted successfully!");
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error.response?.data?.detail ?? "Failed to delete sub-app";
      toast.error(message);
    },
  });
};

// Hook to toggle sub-app enabled status (optimized for quick toggles)
export const useToggleSubAppEnabled = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      subapps.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: subappKeys.list("admin") });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<SubAppListResponse>(
        subappKeys.list("admin"),
      );

      // Optimistically update the cache
      queryClient.setQueryData(
        subappKeys.list("admin"),
        (old: SubAppListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            subapps: old.subapps.map((subapp) =>
              subapp.id === id ? { ...subapp, enabled } : subapp,
            ),
          };
        },
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          subappKeys.list("admin"),
          context.previousData,
        );
      }

      const message = "Failed to update sub-app status";
      toast.error(message);
    },
    onSuccess: (updatedSubApp) => {
      // Update individual sub-app cache
      queryClient.setQueryData(
        subappKeys.detail(updatedSubApp.id),
        updatedSubApp,
      );
      queryClient.setQueryData(
        subappKeys.detail(updatedSubApp.slug),
        updatedSubApp,
      );

      // Invalidate stats
      void queryClient.invalidateQueries({ queryKey: subappKeys.stats() });

      const action = updatedSubApp.enabled ? "enabled" : "disabled";
      toast.success(`Sub-app "${updatedSubApp.name}" ${action}!`);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      void queryClient.invalidateQueries({ queryKey: subappKeys.lists() });
    },
  });
};

// Hook for batch operations (future enhancement)
export const useBulkUpdateSubApps = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{ id: string; data: Partial<SubApp> }>,
    ) => {
      const results = await Promise.all(
        updates.map(({ id, data }) => subapps.update(id, data)),
      );
      return results;
    },
    onSuccess: (results) => {
      // Invalidate all sub-app related queries
      void queryClient.invalidateQueries({ queryKey: subappKeys.all });

      toast.success(`Successfully updated ${results.length} sub-apps!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error.response?.data?.detail ?? "Failed to update sub-apps";
      toast.error(message);
    },
  });
};
