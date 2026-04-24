import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";

export interface CameraAlias {
  id: string;
  original_name: string;
  display_name: string;
  brand?: string;
  model?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CameraAliasCreate {
  original_name: string;
  display_name: string;
  brand?: string;
  model?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CameraAliasUpdate {
  original_name?: string;
  display_name?: string;
  brand?: string;
  model?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CameraAliasListResponse {
  aliases: CameraAlias[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CameraDiscoveryItem {
  original_name: string;
  camera_make?: string;
  camera_model?: string;
  photo_count: number;
  has_alias: boolean;
}

export interface CameraDiscoveryResponse {
  cameras: CameraDiscoveryItem[];
  total_unique_cameras: number;
  total_photos: number;
}

export interface CameraAliasFilters {
  search?: string;
  brand?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

// Query key factory
export const cameraAliasKeys = {
  all: ["camera-aliases"] as const,
  lists: () => [...cameraAliasKeys.all, "list"] as const,
  list: (filters: CameraAliasFilters) =>
    [...cameraAliasKeys.lists(), filters] as const,
  details: () => [...cameraAliasKeys.all, "detail"] as const,
  detail: (id: string) => [...cameraAliasKeys.details(), id] as const,
  discovery: () => [...cameraAliasKeys.all, "discovery"] as const,
};

// Hooks

export function useCameraAliases(filters: CameraAliasFilters = {}) {
  return useQuery<CameraAliasListResponse>({
    queryKey: cameraAliasKeys.list(filters),
    queryFn: async (): Promise<CameraAliasListResponse> => {
      const params = new URLSearchParams();

      if (filters.page) params.append("page", filters.page.toString());
      if (filters.per_page)
        params.append("per_page", filters.per_page.toString());
      if (filters.search) params.append("search", filters.search);
      if (filters.brand) params.append("brand", filters.brand);
      if (filters.is_active !== undefined)
        params.append("is_active", filters.is_active.toString());

      const response = await apiClient.get<CameraAliasListResponse>(
        `/camera-aliases?${params.toString()}`,
      );
      return response.data;
    },
  });
}

export function useCameraAlias(id: string) {
  return useQuery<CameraAlias>({
    queryKey: cameraAliasKeys.detail(id),
    queryFn: async (): Promise<CameraAlias> => {
      const response = await apiClient.get<CameraAlias>(
        `/camera-aliases/${id}`,
      );
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCameraDiscovery() {
  return useQuery<CameraDiscoveryResponse>({
    queryKey: cameraAliasKeys.discovery(),
    queryFn: async (): Promise<CameraDiscoveryResponse> => {
      const response = await apiClient.get<CameraDiscoveryResponse>(
        "/camera-aliases/discover/cameras",
      );
      return response.data;
    },
  });
}

export function useUpdateCameraAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CameraAliasUpdate;
    }): Promise<CameraAlias> => {
      const response = await apiClient.put<CameraAlias>(
        `/camera-aliases/${id}`,
        data,
      );
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: cameraAliasKeys.lists() });
      void queryClient.invalidateQueries({
        queryKey: cameraAliasKeys.detail(id),
      });
      void queryClient.invalidateQueries({
        queryKey: cameraAliasKeys.discovery(),
      });
    },
  });
}
