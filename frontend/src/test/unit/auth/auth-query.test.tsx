/**
 * Unit Tests for Auth Query Hooks
 * Tests the TanStack Query integration, auth-aware retry logic,
 * and query invalidation functionality.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  createAuthQueryClient,
  authAwareRetry,
  useAuthMutation,
  withTokenCheck,
  authQueryKeys,
} from "@/hooks/useAuthQuery";
import { useAuthStore } from "@/stores/authStore";

// Mock the auth store
vi.mock("@/stores/authStore", () => {
  const state: any = {
    isAuthenticated: true,
    accessToken: "valid-token",
    tokenExpiry: Date.now() + 900000,
    isRefreshing: false,
    refreshToken: vi.fn(),
    isTokenExpired: vi.fn(),
    clearAuth: vi.fn(),
  };
  const mockStoreFunction = (): typeof state => mockGetState();
  const mockGetState = vi.fn((): typeof state => state);
  const mockSetState = vi.fn((partial: unknown): typeof state => {
    if (typeof partial === "function") {
      return (partial as (state: typeof state) => typeof state)(state);
    }
    return Object.assign({}, state, partial as Partial<typeof state>);
  });
  const mockSubscribe = vi.fn();

  const useAuthStore = Object.assign(mockStoreFunction, {
    getState: mockGetState,
    setState: mockSetState,
    subscribe: mockSubscribe,
  });
  return { useAuthStore };
});

const mockAuthState = {
  isAuthenticated: true,
  accessToken: "valid-token",
  tokenExpiry: Date.now() + 900000, // 15 minutes from now
  isRefreshing: false,
  refreshToken: vi.fn(),
  isTokenExpired: vi.fn(),
  clearAuth: vi.fn(),
};

describe("Auth Query Hooks", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Align with current store API: use global auth store if needed
    (window as unknown as { __authStore: unknown }).__authStore = {
      getState: () => mockAuthState,
    };
    // Ensure hook reads latest getState mock returns
    (
      useAuthStore as {
        getState: { mockReturnValue: (value: unknown) => void };
      }
    ).getState.mockReturnValue(mockAuthState as unknown as never);
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllTimers();
  });

  describe("createAuthQueryClient", () => {
    it("should create query client with auth-aware configuration", () => {
      const authQueryClient = createAuthQueryClient();

      expect(authQueryClient).toBeInstanceOf(QueryClient);

      // Test default options
      const defaultOptions = authQueryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000); // 5 minutes
      expect(defaultOptions.queries?.gcTime).toBe(10 * 60 * 1000); // 10 minutes
    });

    it("should not retry on 401 errors for queries", () => {
      const authQueryClient = createAuthQueryClient();
      const retryFunction = authQueryClient.getDefaultOptions().queries?.retry;

      if (typeof retryFunction === "function") {
        // Simulate 401 error
        const error = { response: { status: 401 } };
        const shouldRetry = retryFunction(0, error as Error);
        expect(shouldRetry).toBe(false);
      }
    });

    it("should retry non-401 errors up to 3 times for queries", () => {
      const authQueryClient = createAuthQueryClient();
      const retryFunction = authQueryClient.getDefaultOptions().queries?.retry;

      if (typeof retryFunction === "function") {
        // Simulate 500 error
        const error = { response: { status: 500 } };

        expect(retryFunction(0, error as Error)).toBe(true); // First retry
        expect(retryFunction(1, error as Error)).toBe(true); // Second retry
        expect(retryFunction(2, error as Error)).toBe(true); // Third retry
        expect(retryFunction(3, error as Error)).toBe(false); // No fourth retry
      }
    });

    it("should not retry on 401 errors for mutations", () => {
      const authQueryClient = createAuthQueryClient();
      const retryFunction =
        authQueryClient.getDefaultOptions().mutations?.retry;

      if (typeof retryFunction === "function") {
        const error = { response: { status: 401 } };
        const shouldRetry = retryFunction(0, error as Error);
        expect(shouldRetry).toBe(false);
      }
    });
  });

  describe("authAwareRetry", () => {
    it("should refresh token and retry on first 401 error", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isRefreshing: false,
      });

      const error = { response: { status: 401 } };
      const shouldRetry = await authAwareRetry(0, error);

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(shouldRetry).toBe(true);
    });

    it("should not retry on second 401 error", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isRefreshing: false,
      });

      const error = { response: { status: 401 } };
      const shouldRetry = await authAwareRetry(1, error); // Second attempt

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(shouldRetry).toBe(false);
    });

    it("should not retry if already refreshing", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isRefreshing: true, // Already refreshing
      });

      const error = { response: { status: 401 } };
      const shouldRetry = await authAwareRetry(0, error);

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(shouldRetry).toBe(false);
    });

    it("should not retry if refresh fails", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(false);
      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isRefreshing: false,
      });

      const error = { response: { status: 401 } };
      const shouldRetry = await authAwareRetry(0, error);

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(shouldRetry).toBe(false);
    });

    it("should use standard retry logic for non-401 errors", async () => {
      const error = { response: { status: 500 } };

      expect(await authAwareRetry(0, error)).toBe(true);
      expect(await authAwareRetry(1, error)).toBe(true);
      expect(await authAwareRetry(2, error)).toBe(true);
      expect(await authAwareRetry(3, error)).toBe(false);
    });

    it("should handle errors without response status", async () => {
      const error = new Error("Network error");

      expect(await authAwareRetry(0, error)).toBe(true);
      expect(await authAwareRetry(3, error)).toBe(false);
    });
  });

  describe("useAuthMutation", () => {
    let localQueryClient: QueryClient;

    beforeEach(() => {
      localQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={localQueryClient}>
        {children}
      </QueryClientProvider>
    );

    it("should preemptively refresh expired tokens", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const { result } = renderHook(() => useAuthMutation(), { wrapper });

      const mockApiCall = vi.fn().mockResolvedValue("success");

      await act(async () => {
        const response = await result.current.withTokenRefresh(mockApiCall);
        expect(response).toBe("success");
      });

      expect(mockIsTokenExpired).toHaveBeenCalled();
      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockApiCall).toHaveBeenCalled();
    });

    it("should throw error if token refresh fails", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(false);
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const { result } = renderHook(() => useAuthMutation(), { wrapper });

      const mockApiCall = vi.fn();

      await act(async () => {
        try {
          await result.current.withTokenRefresh(mockApiCall);
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect((error as Error).message).toBe("Authentication required");
        }
      });

      expect(mockApiCall).not.toHaveBeenCalled();
    });

    it("should retry on 401 error during API call", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      const mockIsTokenExpired = vi.fn().mockReturnValue(false);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const { result } = renderHook(() => useAuthMutation(), { wrapper });

      let callCount = 0;
      const mockApiCall = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call fails with 401
          const error = new Error("Unauthorized");
          (error as { response: { status: number } }).response = {
            status: 401,
          };
          throw error;
        }
        return "success"; // Second call succeeds
      });

      await act(async () => {
        const response = await result.current.withTokenRefresh(mockApiCall);
        expect(response).toBe("success");
      });

      expect(mockApiCall).toHaveBeenCalledTimes(2); // Original + retry
      expect(mockRefreshToken).toHaveBeenCalled();
    });

    it("should throw error if retry also fails", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      const mockIsTokenExpired = vi.fn().mockReturnValue(false);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const { result } = renderHook(() => useAuthMutation(), { wrapper });

      const apiError = new Error("Still unauthorized");
      (apiError as { response: { status: number } }).response = { status: 401 };
      const mockApiCall = vi.fn().mockRejectedValue(apiError);

      await act(async () => {
        try {
          await result.current.withTokenRefresh(mockApiCall);
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBe(apiError);
        }
      });

      expect(mockApiCall).toHaveBeenCalledTimes(2); // Original + retry
    });

    it("should not refresh for non-401 errors", async () => {
      const mockRefreshToken = vi.fn();
      const mockIsTokenExpired = vi.fn().mockReturnValue(false);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const { result } = renderHook(() => useAuthMutation(), { wrapper });

      const apiError = new Error("Server error");
      (apiError as { response: { status: number } }).response = { status: 500 };
      const mockApiCall = vi.fn().mockRejectedValue(apiError);

      await act(async () => {
        try {
          await result.current.withTokenRefresh(mockApiCall);
          expect.fail("Should have thrown an error");
        } catch (error) {
          expect(error).toBe(apiError);
        }
      });

      expect(mockApiCall).toHaveBeenCalledTimes(1); // No retry
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe("withTokenCheck", () => {
    it("should refresh token if expired before query execution", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: true,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const mockQueryFn = vi.fn().mockResolvedValue("query result");
      const wrappedQueryFn = withTokenCheck(mockQueryFn);

      const result = await wrappedQueryFn();

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockQueryFn).toHaveBeenCalled();
      expect(result).toBe("query result");
    });

    it("should not refresh if token is valid", async () => {
      const mockRefreshToken = vi.fn();
      const mockIsTokenExpired = vi.fn().mockReturnValue(false);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: true,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const mockQueryFn = vi.fn().mockResolvedValue("query result");
      const wrappedQueryFn = withTokenCheck(mockQueryFn);

      const result = await wrappedQueryFn();

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockQueryFn).toHaveBeenCalled();
      expect(result).toBe("query result");
    });

    it("should not refresh if user is not authenticated", async () => {
      const mockRefreshToken = vi.fn();
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: false, // Not authenticated
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const mockQueryFn = vi.fn().mockResolvedValue("query result");
      const wrappedQueryFn = withTokenCheck(mockQueryFn);

      const result = await wrappedQueryFn();

      expect(mockRefreshToken).not.toHaveBeenCalled();
      expect(mockQueryFn).toHaveBeenCalled();
      expect(result).toBe("query result");
    });
  });

  describe("authQueryKeys", () => {
    it("should provide correct query key structures", () => {
      expect(authQueryKeys.all).toEqual(["auth"]);
      expect(authQueryKeys.user()).toEqual(["auth", "user"]);
      expect(authQueryKeys.userProfile("123")).toEqual(["auth", "user", "123"]);
      expect(authQueryKeys.sessions()).toEqual(["auth", "sessions"]);
    });

    it("should maintain type safety for query keys", () => {
      // This test ensures TypeScript type safety
      const allKeys: readonly string[] = authQueryKeys.all;
      const userKeys: readonly string[] = authQueryKeys.user();
      const profileKeys: readonly string[] = authQueryKeys.userProfile("test");
      const sessionKeys: readonly string[] = authQueryKeys.sessions();

      expect(allKeys).toBeDefined();
      expect(userKeys).toBeDefined();
      expect(profileKeys).toBeDefined();
      expect(sessionKeys).toBeDefined();
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle complete auth flow with expired token", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(true);
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: true,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      // Simulate a complete auth-aware query
      const mockApiCall = vi.fn().mockResolvedValue("protected data");
      const authAwareQuery = withTokenCheck(mockApiCall);

      const result = await authAwareQuery();

      expect(mockIsTokenExpired).toHaveBeenCalled();
      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockApiCall).toHaveBeenCalled();
      expect(result).toBe("protected data");
    });

    it("should handle auth errors gracefully", async () => {
      const mockRefreshToken = vi.fn().mockResolvedValue(false);
      const mockIsTokenExpired = vi.fn().mockReturnValue(true);

      (
        useAuthStore as {
          getState: { mockReturnValue: (value: unknown) => void };
        }
      ).getState.mockReturnValue({
        ...mockAuthState,
        isAuthenticated: true,
        refreshToken: mockRefreshToken,
        isTokenExpired: mockIsTokenExpired,
      });

      const mockApiCall = vi.fn().mockResolvedValue("data");
      const authAwareQuery = withTokenCheck(mockApiCall);

      // Should still execute the query even if refresh fails
      const result = await authAwareQuery();
      expect(result).toBe("data");
    });
  });
});
