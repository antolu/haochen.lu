import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface LensAlias {
  id: string;
  original_name: string;
  display_name: string;
  brand?: string;
  model?: string;
  mount_type?: string;
  focal_length?: string;
  max_aperture?: string;
  lens_type?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LensAliasCreate {
  original_name: string;
  display_name: string;
  brand?: string;
  model?: string;
  mount_type?: string;
  focal_length?: string;
  max_aperture?: string;
  lens_type?: string;
  notes?: string;
  is_active?: boolean;
}

export interface LensAliasUpdate {
  original_name?: string;
  display_name?: string;
  brand?: string;
  model?: string;
  mount_type?: string;
  focal_length?: string;
  max_aperture?: string;
  lens_type?: string;
  notes?: string;
  is_active?: boolean;
}

export interface LensAliasListResponse {
  aliases: LensAlias[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface LensDiscoveryItem {
  original_name: string;
  photo_count: number;
  has_alias: boolean;
}

export interface LensDiscoveryResponse {
  lenses: LensDiscoveryItem[];
  total_unique_lenses: number;
  total_photos: number;
}

export interface LensAliasFilters {
  search?: string;
  brand?: string;
  mount_type?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

// Query key factory
export const lensAliasKeys = {
  all: ['lens-aliases'] as const,
  lists: () => [...lensAliasKeys.all, 'list'] as const,
  list: (filters: LensAliasFilters) => [...lensAliasKeys.lists(), filters] as const,
  details: () => [...lensAliasKeys.all, 'detail'] as const,
  detail: (id: string) => [...lensAliasKeys.details(), id] as const,
  discovery: () => [...lensAliasKeys.all, 'discovery'] as const,
};

// Hooks

export function useLensAliases(filters: LensAliasFilters = {}) {
  return useQuery<LensAliasListResponse>({
    queryKey: lensAliasKeys.list(filters),
    queryFn: async (): Promise<LensAliasListResponse> => {
      const params = new URLSearchParams();

      if (filters.page) params.append('page', filters.page.toString());
      if (filters.per_page) params.append('per_page', filters.per_page.toString());
      if (filters.search) params.append('search', filters.search);
      if (filters.brand) params.append('brand', filters.brand);
      if (filters.mount_type) params.append('mount_type', filters.mount_type);
      if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());

      const response = await apiClient.get<LensAliasListResponse>(
        `/lens-aliases?${params.toString()}`
      );
      return response.data;
    },
  });
}

export function useLensAlias(id: string) {
  return useQuery<LensAlias>({
    queryKey: lensAliasKeys.detail(id),
    queryFn: async (): Promise<LensAlias> => {
      const response = await apiClient.get<LensAlias>(`/lens-aliases/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useLensDiscovery() {
  return useQuery<LensDiscoveryResponse>({
    queryKey: lensAliasKeys.discovery(),
    queryFn: async (): Promise<LensDiscoveryResponse> => {
      const response = await apiClient.get<LensDiscoveryResponse>('/lens-aliases/discover/lenses');
      return response.data;
    },
  });
}

export function useCreateLensAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LensAliasCreate): Promise<LensAlias> => {
      const response = await apiClient.post<LensAlias>('/lens-aliases', data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.discovery() });
    },
  });
}

export function useUpdateLensAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: LensAliasUpdate }): Promise<LensAlias> => {
      const response = await apiClient.put<LensAlias>(`/lens-aliases/${id}`, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.discovery() });
    },
  });
}

export function useDeleteLensAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/lens-aliases/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: lensAliasKeys.discovery() });
    },
  });
}
