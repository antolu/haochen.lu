import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { photos } from '../api/client';
import type { Photo, PhotoListResponse } from '../types';
import toast from 'react-hot-toast';

// Query Keys
export const photoKeys = {
  all: ['photos'] as const,
  lists: () => [...photoKeys.all, 'list'] as const,
  list: (filters: string) => [...photoKeys.lists(), { filters }] as const,
  details: () => [...photoKeys.all, 'detail'] as const,
  detail: (id: string) => [...photoKeys.details(), id] as const,
  featured: () => [...photoKeys.all, 'featured'] as const,
  stats: () => [...photoKeys.all, 'stats'] as const,
};

// Hook to get all photos (admin view)
export const usePhotos = () => {
  return useQuery({
    queryKey: photoKeys.list('admin'),
    queryFn: () => photos.list(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    select: (data: PhotoListResponse) => ({
      ...data,
      photos: data.photos.sort((a, b) => {
        // Sort by order first, then by date taken (newest first)
        if (a.order !== b.order) return a.order - b.order;
        return new Date(b.date_taken || b.created_at).getTime() - new Date(a.date_taken || a.created_at).getTime();
      }),
    }),
  });
};

// Hook to get photos with infinite scrolling for large galleries
export const useInfinitePhotos = (params: {
  category?: string;
  featured?: boolean;
  order_by?: string;
} = {}) => {
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
  return useQuery({
    queryKey: photoKeys.stats(),
    queryFn: () => photos.getStats(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};

// Hook to upload a new photo
export const useUploadPhoto = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, metadata }: { 
      file: File; 
      metadata: {
        title?: string;
        description?: string;
        category?: string;
        tags?: string;
        comments?: string;
        featured?: boolean;
      }
    }) => photos.upload(file, metadata),
    
    onMutate: async ({ file, metadata }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: photoKeys.lists() });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(photoKeys.list('admin'));

      // Optimistically update with placeholder
      queryClient.setQueryData(photoKeys.list('admin'), (old: any) => {
        if (!old) return { photos: [], total: 0 };

        const optimisticPhoto: Partial<Photo> = {
          id: `temp-${Date.now()}`,
          title: metadata.title || file.name,
          description: metadata.description,
          category: metadata.category,
          tags: metadata.tags,
          featured: metadata.featured || false,
          filename: file.name,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Placeholder paths
          webp_path: '',
          thumbnail_path: '',
          original_path: '',
        };

        return {
          ...old,
          photos: [optimisticPhoto as Photo, ...old.photos],
          total: old.total + 1,
        };
      });

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(photoKeys.list('admin'), context.previousData);
      }
      toast.error('Failed to upload photo. Please try again.');
    },

    onSuccess: (newPhoto) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
      
      toast.success(`"${newPhoto.title}" uploaded successfully!`);
    },

    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
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
      const previousListData = queryClient.getQueryData(photoKeys.list('admin'));
      const previousDetailData = queryClient.getQueryData(photoKeys.detail(id));

      // Optimistically update the list
      queryClient.setQueryData(photoKeys.list('admin'), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          photos: old.photos.map((photo: Photo) =>
            photo.id === id ? { ...photo, ...data, updated_at: new Date().toISOString() } : photo
          ),
        };
      });

      // Optimistically update the detail
      queryClient.setQueryData(photoKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, ...data, updated_at: new Date().toISOString() };
      });

      return { previousListData, previousDetailData };
    },

    onError: (_err, { id }, context) => {
      // If the mutation fails, roll back
      if (context?.previousListData) {
        queryClient.setQueryData(photoKeys.list('admin'), context.previousListData);
      }
      if (context?.previousDetailData) {
        queryClient.setQueryData(photoKeys.detail(id), context.previousDetailData);
      }
      toast.error('Failed to update photo. Please try again.');
    },

    onSuccess: (updatedPhoto) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: photoKeys.detail(updatedPhoto.id) });
      queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      
      if (updatedPhoto.featured) {
        queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
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
      const previousData = queryClient.getQueryData(photoKeys.list('admin'));

      // Optimistically update by removing the photo
      queryClient.setQueryData(photoKeys.list('admin'), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          photos: old.photos.filter((photo: Photo) => photo.id !== id),
          total: old.total - 1,
        };
      });

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, roll back
      if (context?.previousData) {
        queryClient.setQueryData(photoKeys.list('admin'), context.previousData);
      }
      toast.error('Failed to delete photo. Please try again.');
    },

    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
      
      toast.success('Photo deleted successfully!');
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
      const previousData = queryClient.getQueryData(photoKeys.list('admin'));

      // Optimistically update
      queryClient.setQueryData(photoKeys.list('admin'), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          photos: old.photos.map((photo: Photo) =>
            photo.id === id 
              ? { ...photo, featured, updated_at: new Date().toISOString() } 
              : photo
          ),
        };
      });

      return { previousData };
    },

    onError: (_err, _variables, context) => {
      // If the mutation fails, roll back
      if (context?.previousData) {
        queryClient.setQueryData(photoKeys.list('admin'), context.previousData);
      }
      toast.error('Failed to update photo status. Please try again.');
    },

    onSuccess: ({ featured }) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: photoKeys.lists() });
      queryClient.invalidateQueries({ queryKey: photoKeys.featured() });
      queryClient.invalidateQueries({ queryKey: photoKeys.stats() });
      
      toast.success(featured ? 'Photo added to featured!' : 'Photo removed from featured!');
    },
  });
};