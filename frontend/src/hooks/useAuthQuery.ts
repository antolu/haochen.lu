/**
 * TanStack Query integration for authentication
 * Provides automatic token refresh and error handling
 */
import { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import type { AxiosError } from "axios";

interface AuthState {
  isAuthenticated: boolean;
  // Add other properties as needed
}

// Create a custom query client with auth-aware error handling
export const createAuthQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: AxiosError) => {
          // Don't retry on authentication errors
          if (error?.response?.status === 401) {
            return false;
          }
          // Retry up to 3 times for other errors
          return failureCount < 3;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime in v5)
      },
      mutations: {
        retry: (failureCount, error: AxiosError) => {
          // Don't retry authentication errors
          if (error?.response?.status === 401) {
            return false;
          }
          // Retry once for other errors
          return failureCount < 1;
        },
      },
    },
  });
};

// Auth-aware query retry function
export const authAwareRetry = async (
  failureCount: number,
  error: AxiosError,
) => {
  const authStore = useAuthStore.getState();

  // If it's a 401 error, try to refresh the token
  if (error?.response?.status === 401) {
    // Only try refresh once per query
    if (failureCount === 0 && !authStore.isRefreshing) {
      const refreshSuccess = await authStore.refreshToken();
      if (refreshSuccess) {
        // Token was refreshed, retry the query
        return true;
      }
    }
    // If refresh failed or this is a retry, don't retry again
    return false;
  }

  // For other errors, use standard retry logic
  return failureCount < 3;
};

// Hook for auth-aware mutations
export const useAuthMutation = () => {
  const { refreshToken, isTokenExpired } = useAuthStore();

  const withTokenRefresh = async <T>(fn: () => Promise<T>): Promise<T> => {
    // Check if token is expired before making the request
    if (isTokenExpired()) {
      const refreshSuccess = await refreshToken();
      if (!refreshSuccess) {
        throw new Error("Authentication required");
      }
    }

    try {
      return await fn();
    } catch (error: unknown) {
      // If request fails with 401, try refreshing token once
      if ((error as AxiosError)?.response?.status === 401) {
        const refreshSuccess = await refreshToken();
        if (refreshSuccess) {
          // Retry the original request
          return await fn();
        }
      }
      throw error;
    }
  };

  return { withTokenRefresh };
};

// Auth state sync helper
export const syncAuthState = (queryClient: QueryClient) => {
  // Listen for auth state changes
  useAuthStore.subscribe((state: AuthState, prevState: AuthState) => {
    // If user logged out, clear all queries
    if (prevState.isAuthenticated && !state.isAuthenticated) {
      queryClient.clear();
      queryClient.removeQueries();
    }

    // If user logged in, invalidate auth-dependent queries
    if (!prevState.isAuthenticated && state.isAuthenticated) {
      void queryClient.invalidateQueries({
        predicate: (query) => {
          // Invalidate queries that might need authentication
          const queryKey = query.queryKey[0] as string;
          return ["projects", "photos", "blog", "subapps"].some((key) =>
            queryKey?.includes(key),
          );
        },
      });
    }
  });
};

// Token expiry middleware for queries
export const withTokenCheck = <T>(queryFn: () => Promise<T>) => {
  return async (): Promise<T> => {
    const authStore = useAuthStore.getState();

    // If token is expired, try to refresh it before the query
    if (authStore.isAuthenticated && authStore.isTokenExpired()) {
      await authStore.refreshToken();
    }

    return queryFn();
  };
};

// Query key factory for auth-dependent queries
export const authQueryKeys = {
  all: ["auth"] as const,
  user: () => [...authQueryKeys.all, "user"] as const,
  userProfile: (userId: string) => [...authQueryKeys.user(), userId] as const,
  sessions: () => [...authQueryKeys.all, "sessions"] as const,
} as const;
