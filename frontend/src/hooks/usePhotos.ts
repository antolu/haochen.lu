import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { photos } from "../api/client";
import type { Photo, PhotoListResponse, PhotoStatsSummary } from "../types";
import type { OrderByOption } from "../components/OrderBySelector";
import { usePhotoCacheStore } from "../stores/photoCache";
import toast from "react-hot-toast";
import { useCallback, useMemo, useEffect } from "react";

// Query Keys
export const photoKeys = {
  all: ["photos"] as const,
  lists: () => [...photoKeys.all, "list"] as const,
  list: (filters: string) => [...photoKeys.lists(), { filters }] as const,
  details: () => [...photoKeys.all, "detail"] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
  featured: () => [...photoKeys.all, "featured"] as const,
  stats: () => [...photoKeys.all, "stats"] as const,
};

// Hook to get all photos (admin view)
export const usePhotos = () => {
  return useQuery({
    queryKey: photoKeys.list("admin-order"),
    queryFn: () => photos.list({ order_by: "order", category: "photography" }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Optimized hook for photography page with intelligent caching
export const useOptimizedPhotos = (
  orderBy: OrderByOption,
  photosPerPage = 24,
) => {
  const {
    cache,
    activeOrder,
    setPhotos,
    switchOrder,
    setActiveOrder,
    setTransitioning,
    isCacheValid,
  } = usePhotoCacheStore();

  const currentCache = cache[orderBy];
  const isValidCache = isCacheValid(orderBy);

  // Smart order switching logic
  const handleOrderSwitch = useCallback(
    (newOrder: OrderByOption) => {
      if (newOrder === activeOrder)
        return { photos: currentCache.photos, isFromCache: true };

      const result = switchOrder(newOrder);
      setActiveOrder(newOrder);

      if (result.shouldShowCached && result.cachedPhotos.length > 0) {
        return { photos: result.cachedPhotos, isFromCache: true };
      }

      return { photos: [], isFromCache: false };
    },
    [activeOrder, currentCache, switchOrder, setActiveOrder],
  );

  // Main query that respects cache
  const photosQuery = useQuery({
    queryKey: ["optimized-photos", orderBy],
    queryFn: async () => {
      const response = await photos.list({
        page: 1,
        per_page: photosPerPage,
        order_by: orderBy,
        category: "photography",
      });
      setPhotos(orderBy, response, 1);
      return response;
    },
    enabled: !isValidCache || currentCache.photos.length === 0,
    staleTime: 1000 * 60 * 5,
  });

  // Load more functionality
  const loadMoreQuery = useQuery({
    queryKey: ["load-more-photos", orderBy, currentCache.loadedPages.size + 1],
    queryFn: async () => {
      const nextPage = currentCache.loadedPages.size + 1;
      const response = await photos.list({
        page: nextPage,
        per_page: photosPerPage,
        order_by: orderBy,
        category: "photography",
      });
      setPhotos(orderBy, response, nextPage);
      return response;
    },
    enabled: false, // Only trigger manually
    staleTime: 1000 * 60 * 5,
  });

  // Determine photos to show
  const displayPhotos = useMemo(() => {
    if (isValidCache && currentCache.photos.length > 0) {
      return currentCache.photos;
    }
    return photosQuery.data?.photos || [];
  }, [isValidCache, currentCache.photos, photosQuery.data?.photos]);

  // Loading states
  const isLoading = !isValidCache && photosQuery.isLoading;
  const isLoadingMore = loadMoreQuery.isFetching;

  // Pagination info
  const hasMore = useMemo(() => {
    if (!currentCache.total) return false;
    return displayPhotos.length < currentCache.total;
  }, [currentCache.total, displayPhotos.length]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadMoreQuery.refetch();
    }
  }, [isLoadingMore, hasMore, loadMoreQuery]);

  // Clear loading state when photos are loaded
  const isTransitioning = usePhotoCacheStore((state) => state.isTransitioning);

  useEffect(() => {
    if (isTransitioning && displayPhotos.length > 0) {
      setTransitioning(false);
    }
  }, [isTransitioning, displayPhotos.length, setTransitioning]);

  return {
    photos: displayPhotos,
    isLoading,
    isLoadingMore,
    error: photosQuery.error || loadMoreQuery.error,
    total: currentCache.total,
    hasMore,
    loadMore,
    handleOrderSwitch,
    cacheStats: {
      cached: currentCache.photos.length,
      total: currentCache.total,
      pagesLoaded: currentCache.loadedPages.size,
    },
  };
};

// Hook to get photos with infinite scrolling for large galleries
export const useInfinitePhotos = (
  params: {
    category?: string;
    featured?: boolean;
    order_by?: string;
  } = {},
) => {
  return useInfiniteQuery({
    queryKey: photoKeys.list(`infinite-${JSON.stringify(params)}`),
    queryFn: ({ pageParam = 1 }) =>
      photos.list({
        page: pageParam,
        per_page: 50,
        ...params,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const totalPages = Math.ceil(lastPage.total / 50);
      return allPages.length < totalPages ? allPages.length + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to get featured photos
export const useFeaturedPhotos = (limit = 6) => {
  return useQuery({
    queryKey: [...photoKeys.featured(), limit],
    queryFn: () => photos.getFeatured(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

// Hook to get a single photo
export const usePhoto = (id: string, enabled = true) => {
  return useQuery({
    queryKey: photoKeys.detail(id),
    queryFn: () => photos.getById(id),
    enabled: enabled && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Hook to get photo statistics
export const usePhotoStats = () => {
  return useQuery<PhotoStatsSummary>({
    queryKey: photoKeys.stats(),
    queryFn: () => photos.getStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

// Hook to load distinct tags
export const usePhotoTags = () => {
  return useQuery({
    queryKey: [...photoKeys.all, "tags"],
    queryFn: () => photos.getTags(),
    staleTime: 1000 * 60 * 5,
  });
};

// Hook to upload a new photo
export const useUploadPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      file,
      metadata,
    }: {
      file: File;
      metadata: {
        title?: string;
        description?: string;
        category?: string;
        tags?: string;
        comments?: string;
        featured?: boolean;
      };
    }) => {
      // Create an upload ID to correlate WS progress
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      // Attempt to open WS for progress (best-effort)
      try {
        const wsBase =
          (import.meta.env.VITE_WS_URL as string | undefined) ??
          `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
        const ws = new WebSocket(`${wsBase}/uploads/${uploadId}`);
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as {
              type?: string;
              stage?: string;
              progress?: number;
            };
            if (
              data?.type === "progress" &&
              typeof data.progress === "number"
            ) {
              // Broadcast via a custom event; PhotoUpload component can listen if desired
              window.dispatchEvent(
                new CustomEvent("upload:progress", {
                  detail: {
                    uploadId,
                    stage: data.stage,
                    progress: data.progress,
                  },
                }),
              );
            }
          } catch {
            // ignore
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch {
            // Ignore close errors
          }
        };
      } catch {
        // Ignore WS errors; upload continues
      }

      return photos.upload(file, metadata, { uploadId });
    },

    onMutate: async ({ file, metadata }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
      );

      // Optimistically update with placeholder
      queryClient.setQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
        (old) => {
          if (!old)
            return {
              photos: [],
              total: 0,
              page: 1,
              per_page: 0,
              pages: 1,
            } as PhotoListResponse;

          const optimisticPhoto: Partial<Photo> = {
            id: `temp-${Date.now()}`,
            title: metadata.title ?? file.name,
            description: metadata.description,
            category: metadata.category,
            tags: metadata.tags,
            featured: metadata.featured ?? false,
            filename: file.name,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Placeholder paths
            webp_path: "",
            thumbnail_path: "",
            original_path: "",
          };

          return {
            ...old,
            photos: [optimisticPhoto as Photo, ...old.photos],
            total: old.total + 1,
          };
        },
      );

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          photoKeys.list("admin-order"),
          context.previousData,
        );
      }
      toast.error("Failed to upload photo. Please try again.");
    },

    onSuccess: (newPhoto) => {
      // Invalidate and refetch
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.featured() });

      toast.success(`"${newPhoto.title}" uploaded successfully!`);
    },

    onSettled: () => {
      // Always refetch after error or success
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
};

// Hook to update a photo
export const useUpdatePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Photo> }) =>
      photos.update(id, data),

    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });
      await queryClient.cancelQueries({ queryKey: photoKeys.detail(id) });

      // Snapshot the previous values
      const previousListData = queryClient.getQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
      );
      const previousDetailData = queryClient.getQueryData<Photo>(
        photoKeys.detail(id),
      );

      // Optimistically update the list
      queryClient.setQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
        (old) => {
          if (!old) return old as unknown as PhotoListResponse;
          return {
            ...old,
            photos: old.photos.map((photo: Photo) =>
              photo.id === id
                ? { ...photo, ...data, updated_at: new Date().toISOString() }
                : photo,
            ),
          };
        },
      );

      // Optimistically update the detail
      queryClient.setQueryData<Photo>(photoKeys.detail(id), (old) => {
        if (!old) return old as unknown as Photo;
        return {
          ...old,
          ...data,
          updated_at: new Date().toISOString(),
        } as Photo;
      });

      return { previousListData, previousDetailData };
    },

    onError: (_err, { id }, context) => {
      // If the mutation fails, roll back
      if (context?.previousListData) {
        queryClient.setQueryData(
          photoKeys.list("admin-order"),
          context.previousListData,
        );
      }
      if (context?.previousDetailData) {
        queryClient.setQueryData(
          photoKeys.detail(id),
          context.previousDetailData,
        );
      }
      toast.error("Failed to update photo. Please try again.");
    },

    onSuccess: (updatedPhoto) => {
      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: photoKeys.detail(updatedPhoto.id),
      });
      void queryClient.invalidateQueries({ queryKey: photoKeys.stats() });

      if (updatedPhoto.featured) {
        void queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
      }

      toast.success(`"${updatedPhoto.title}" updated successfully!`);
    },
  });
};

// Hook to delete a photo
export const useDeletePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => photos.delete(id),

    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
      );

      // Optimistically update by removing the photo
      queryClient.setQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
        (old) => {
          if (!old) return old as unknown as PhotoListResponse;
          return {
            ...old,
            photos: old.photos.filter((photo: Photo) => photo.id !== id),
            total: old.total - 1,
          };
        },
      );

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          photoKeys.list("admin-order"),
          context.previousData,
        );
      }
      toast.error("Failed to delete photo. Please try again.");
    },

    onSuccess: () => {
      // Invalidate and refetch
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.featured() });

      toast.success("Photo deleted successfully!");
    },
  });
};

// Hook to toggle photo featured status
export const useTogglePhotoFeatured = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) =>
      photos.update(id, { featured }),

    onMutate: async ({ id, featured }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
      );

      // Optimistically update
      queryClient.setQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
        (old) => {
          if (!old) return old as unknown as PhotoListResponse;
          return {
            ...old,
            photos: old.photos.map((photo: Photo) =>
              photo.id === id
                ? { ...photo, featured, updated_at: new Date().toISOString() }
                : photo,
            ),
          };
        },
      );

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          photoKeys.list("admin-order"),
          context.previousData,
        );
      }
      toast.error("Failed to update photo status. Please try again.");
    },

    onSuccess: ({ featured }) => {
      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
      void queryClient.invalidateQueries({ queryKey: photoKeys.stats() });

      toast.success(
        featured ? "Photo added to featured!" : "Photo removed from featured!",
      );
    },
  });
};

// Hook to reorder photos
export const useReorderPhotos = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      items,
      normalize = true,
    }: {
      items: { id: string; order: number }[];
      normalize?: boolean;
    }) => photos.reorder(items, normalize),

    onMutate: async ({ items }) => {
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      const previousData = queryClient.getQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
      );

      queryClient.setQueryData<PhotoListResponse>(
        photoKeys.list("admin-order"),
        (old) => {
          if (!old) return old as unknown as PhotoListResponse;
          const orderMap = new Map(items.map((item) => [item.id, item.order]));
          const updated = old.photos.map((photo) =>
            orderMap.has(photo.id)
              ? {
                  ...photo,
                  order: orderMap.get(photo.id) ?? photo.order,
                }
              : photo,
          );
          updated.sort((a, b) => {
            if (a.order !== b.order) {
              return a.order - b.order;
            }
            return (
              new Date(b.date_taken ?? b.created_at).getTime() -
              new Date(a.date_taken ?? a.created_at).getTime()
            );
          });
          return {
            ...old,
            photos: updated,
          };
        },
      );

      return { previousData };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          photoKeys.list("admin-order"),
          context.previousData,
        );
      }
      toast.error("Failed to reorder photos. Please try again.");
    },

    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
    },
  });
};
