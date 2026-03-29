import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { applications } from "../api/client";
import type {
  Application,
  ApplicationListResponse,
  ApplicationStatsSummary,
} from "../types";
import toast from "react-hot-toast";
import type { AxiosError } from "axios";

// Query Keys
export const appKeys = {
  all: ["applications"] as const,
  lists: () => [...appKeys.all, "list"] as const,
  list: (filters: string) => [...appKeys.lists(), { filters }] as const,
  details: () => [...appKeys.all, "detail"] as const,
  detail: (id: string) => [...appKeys.details(), id] as const,
  stats: () => [...appKeys.all, "stats"] as const,
};

export const useApplications = () => {
  return useQuery({
    queryKey: appKeys.list("admin"),
    queryFn: () => applications.listAll(),
    staleTime: 1000 * 60 * 5,
    select: (data: ApplicationListResponse) => ({
      ...data,
      applications: data.applications.sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name),
      ),
    }),
  });
};

export const useApplication = (identifier: string, enabled = true) => {
  return useQuery({
    queryKey: appKeys.detail(identifier),
    queryFn: () => applications.getByIdOrSlug(identifier),
    enabled: enabled && !!identifier,
    staleTime: 1000 * 60 * 5,
  });
};

export const useAppStats = () => {
  return useQuery<ApplicationStatsSummary>({
    queryKey: appKeys.stats(),
    queryFn: () => applications.getStats(),
    staleTime: 1000 * 60 * 2,
  });
};

export const useCreateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<Application, "id" | "slug" | "created_at" | "updated_at">,
    ) => applications.create(data),
    onSuccess: (newApp) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: appKeys.stats() });

      queryClient.setQueryData(appKeys.detail(newApp.id), newApp);

      toast.success(`App "${newApp.name}" created successfully!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error.response?.data?.detail ?? "Failed to create app";
      toast.error(message);
    },
  });
};

export const useUpdateApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Application> }) =>
      applications.update(id, data),
    onSuccess: (updatedApp) => {
      queryClient.setQueryData(
        appKeys.list("admin"),
        (old: ApplicationListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.map((app) =>
              app.id === updatedApp.id ? updatedApp : app,
            ),
          };
        },
      );

      queryClient.setQueryData(appKeys.detail(updatedApp.id), updatedApp);
      queryClient.setQueryData(appKeys.detail(updatedApp.slug), updatedApp);

      void queryClient.invalidateQueries({ queryKey: appKeys.stats() });

      toast.success(`App "${updatedApp.name}" updated successfully!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error.response?.data?.detail ?? "Failed to update app";
      toast.error(message);
    },
  });
};

export const useDeleteApplication = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applications.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData(
        appKeys.list("admin"),
        (old: ApplicationListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.filter(
              (app) => app.id !== deletedId,
            ),
            total: old.total - 1,
          };
        },
      );

      queryClient.removeQueries({ queryKey: appKeys.detail(deletedId) });

      void queryClient.invalidateQueries({ queryKey: appKeys.stats() });

      toast.success("Application deleted successfully!");
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message =
        error.response?.data?.detail ?? "Failed to delete application";
      toast.error(message);
    },
  });
};

export const useToggleAppEnabled = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      applications.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: appKeys.list("admin") });

      const previousData = queryClient.getQueryData<ApplicationListResponse>(
        appKeys.list("admin"),
      );

      queryClient.setQueryData(
        appKeys.list("admin"),
        (old: ApplicationListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.map((app) =>
              app.id === id ? { ...app, enabled } : app,
            ),
          };
        },
      );

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(appKeys.list("admin"), context.previousData);
      }

      const message = "Failed to update app status";
      toast.error(message);
    },
    onSuccess: (updatedApp) => {
      queryClient.setQueryData(appKeys.detail(updatedApp.id), updatedApp);
      queryClient.setQueryData(appKeys.detail(updatedApp.slug), updatedApp);

      void queryClient.invalidateQueries({ queryKey: appKeys.stats() });

      const action = updatedApp.enabled ? "enabled" : "disabled";
      toast.success(`App "${updatedApp.name}" ${action}!`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.lists() });
    },
  });
};

export const useRegenerateCredentials = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => applications.regenerateCredentials(id),
    onSuccess: (updatedApp) => {
      queryClient.setQueryData(
        appKeys.list("admin"),
        (old: ApplicationListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: old.applications.map((app) =>
              app.id === updatedApp.id ? updatedApp : app,
            ),
          };
        },
      );
      toast.success("Credentials regenerated");
    },
    onError: () => {
      toast.error("Failed to regenerate credentials");
    },
  });
};

export const useReorderApplications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: Array<{ id: string; order: number }>) =>
      applications.reorder(items, true),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: appKeys.list("admin") });
      const previous = queryClient.getQueryData<ApplicationListResponse>(
        appKeys.list("admin"),
      );
      const orderMap = new Map(items.map((i) => [i.id, i.order]));
      queryClient.setQueryData(
        appKeys.list("admin"),
        (old: ApplicationListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            applications: [...old.applications].sort(
              (a, b) =>
                (orderMap.get(a.id) ?? a.order) -
                (orderMap.get(b.id) ?? b.order),
            ),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(appKeys.list("admin"), context.previous);
      }
      toast.error("Failed to reorder applications");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appKeys.lists() });
    },
  });
};

export const useBulkUpdateApplications = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: Array<{ id: string; data: Partial<Application> }>,
    ) => {
      const results = await Promise.all(
        updates.map(({ id, data }) => applications.update(id, data)),
      );
      return results;
    },
    onSuccess: (results) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.all });

      toast.success(`Successfully updated ${results.length} apps!`);
    },
    onError: (error: AxiosError<{ detail?: string }>) => {
      const message = error.response?.data?.detail ?? "Failed to update apps";
      toast.error(message);
    },
  });
};
