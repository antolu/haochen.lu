import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profilePictures } from '../api/client';

// Query hooks
export const useProfilePictures = (page = 1, perPage = 20) => {
  return useQuery({
    queryKey: ['profile-pictures', { page, perPage }],
    queryFn: () => profilePictures.list({ page, per_page: perPage }),
  });
};

export const useActiveProfilePicture = () => {
  return useQuery({
    queryKey: ['profile-pictures', 'active'],
    queryFn: profilePictures.getActive,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useProfilePicture = (id: string) => {
  return useQuery({
    queryKey: ['profile-pictures', id],
    queryFn: () => profilePictures.getById(id),
  });
};

// Mutation hooks
export const useUploadProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profilePictures.upload,
    onSuccess: () => {
      // Invalidate profile pictures list
      void queryClient.invalidateQueries({ queryKey: ['profile-pictures'] });
    },
    onError: error => {
      console.error('Failed to upload profile picture:', error);
    },
  });
};

export const useActivateProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profilePictures.activate,
    onSuccess: () => {
      // Invalidate both list and active queries
      void queryClient.invalidateQueries({ queryKey: ['profile-pictures'] });
    },
    onError: error => {
      console.error('Failed to activate profile picture:', error);
    },
  });
};

export const useUpdateProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: { title?: string; is_active?: boolean };
    }) => profilePictures.update(id, updates),
    onSuccess: (_, { id }) => {
      // Invalidate specific profile picture and list queries
      void queryClient.invalidateQueries({ queryKey: ['profile-pictures', id] });
      void queryClient.invalidateQueries({ queryKey: ['profile-pictures'] });
    },
    onError: error => {
      console.error('Failed to update profile picture:', error);
    },
  });
};

export const useDeleteProfilePicture = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profilePictures.delete,
    onSuccess: () => {
      // Invalidate profile pictures list and active query
      void queryClient.invalidateQueries({ queryKey: ['profile-pictures'] });
    },
    onError: error => {
      console.error('Failed to delete profile picture:', error);
    },
  });
};
