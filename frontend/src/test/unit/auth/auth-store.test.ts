import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useAuthStore } from "@/stores/authStore";
import { auth } from "@/api/client";

vi.mock("@/api/client", () => ({
  auth: {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    revokeAllSessions: vi.fn(),
    getMe: vi.fn(),
  },
}));

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", { value: localStorageMock });

const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

const mockUser = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  is_admin: false,
};

describe("Auth Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it("has the expected initial state", () => {
    const { result } = renderHook(() => useAuthStore());

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.tokenExpiry).toBeNull();
    expect(result.current.isRefreshing).toBe(false);
  });

  it("starts the login redirect flow with the provided params", async () => {
    vi.mocked(auth.login).mockResolvedValueOnce();

    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await result.current.login({
        next: "/admin/subapps",
        client_id: "subapp-client",
        redirect_uri: "https://subapp.example/callback",
        response_type: "code",
        state: "opaque-state",
      });
    });

    expect(auth.login).toHaveBeenCalledWith({
      next: "/admin/subapps",
      client_id: "subapp-client",
      redirect_uri: "https://subapp.example/callback",
      response_type: "code",
      state: "opaque-state",
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("maps login API errors into store error state", async () => {
    vi.mocked(auth.login).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { detail: "Access denied" },
      },
    });

    const { result } = renderHook(() => useAuthStore());

    await act(async () => {
      await expect(
        result.current.login({ next: "/admin" }),
      ).rejects.toBeTruthy();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(result.current.error).toBe("Access denied");
    expect(result.current.isLoading).toBe(false);
  });

  it("refreshes the token and user successfully", async () => {
    vi.mocked(auth.refresh).mockResolvedValueOnce({
      access_token: "new-access-token",
      token_type: "bearer",
      expires_in: 900,
      user: mockUser,
    });

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("old-token", 900);
      result.current.setUser(mockUser);
    });

    const refreshSuccess = await act(async () => result.current.refreshToken());

    expect(refreshSuccess).toBe(true);
    expect(result.current.accessToken).toBe("new-access-token");
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isRefreshing).toBe(false);
  });

  it("clears auth state when refresh fails", async () => {
    vi.mocked(auth.refresh).mockRejectedValueOnce(new Error("Refresh failed"));

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("old-token", 900);
      result.current.setUser(mockUser);
    });

    const refreshSuccess = await act(async () => result.current.refreshToken());

    expect(refreshSuccess).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.accessToken).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Token refresh failed:",
      expect.any(Error),
    );
  });

  it("prevents overlapping refresh attempts", async () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("old-token", 900);
      result.current.setUser(mockUser);
      useAuthStore.setState({ isRefreshing: true });
    });

    const secondRefresh = await act(async () => result.current.refreshToken());

    expect(secondRefresh).toBe(false);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("fetches the current user with a valid token", async () => {
    vi.mocked(auth.getMe).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("valid-token", 900);
    });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(auth.getMe).toHaveBeenCalledTimes(1);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("refreshes first when the token is expired during checkAuth", async () => {
    vi.mocked(auth.refresh).mockResolvedValueOnce({
      access_token: "refreshed-token",
      token_type: "bearer",
      expires_in: 900,
      user: mockUser,
    });
    vi.mocked(auth.getMe).mockResolvedValueOnce(mockUser);

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("expired-token", 900);
      useAuthStore.getState().tokenExpiry = Date.now() - 1000;
    });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(auth.getMe).toHaveBeenCalledTimes(1);
    expect(result.current.accessToken).toBe("refreshed-token");
    expect(result.current.user).toEqual(mockUser);
  });

  it("retries /me after a successful refresh", async () => {
    vi.mocked(auth.getMe)
      .mockRejectedValueOnce(new Error("401 Unauthorized"))
      .mockResolvedValueOnce(mockUser);
    vi.mocked(auth.refresh).mockResolvedValueOnce({
      access_token: "refreshed-token",
      token_type: "bearer",
      expires_in: 900,
      user: mockUser,
    });

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("valid-token", 900);
    });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(auth.getMe).toHaveBeenCalledTimes(2);
    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it("clears auth when refresh fails during checkAuth", async () => {
    vi.mocked(auth.refresh).mockRejectedValueOnce(new Error("Refresh failed"));

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("expired-token", 900);
      useAuthStore.getState().tokenExpiry = Date.now() - 1000;
    });

    await act(async () => {
      await result.current.checkAuth();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("logs out successfully", async () => {
    vi.mocked(auth.logout).mockResolvedValueOnce();

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("token", 900);
      result.current.setUser(mockUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("clears auth even if logout fails", async () => {
    vi.mocked(auth.logout).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("token", 900);
      result.current.setUser(mockUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Logout request failed:",
      expect.any(Error),
    );
  });

  it("logs out everywhere successfully", async () => {
    vi.mocked(auth.revokeAllSessions).mockResolvedValueOnce();

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("token", 900);
      result.current.setUser(mockUser);
    });

    await act(async () => {
      await result.current.logoutEverywhere();
    });

    expect(auth.revokeAllSessions).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("clears auth even if revoke-all-sessions fails", async () => {
    vi.mocked(auth.revokeAllSessions).mockRejectedValueOnce(
      new Error("Server error"),
    );

    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("token", 900);
      result.current.setUser(mockUser);
    });

    await act(async () => {
      await result.current.logoutEverywhere();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Logout everywhere request failed:",
      expect.any(Error),
    );
  });

  it("sets and clears utility state correctly", () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setTokens("test-token", 900);
      result.current.setUser(mockUser);
    });

    expect(result.current.isTokenExpired()).toBe(false);
    expect(result.current.user).toEqual(mockUser);

    act(() => {
      useAuthStore.getState().error = "Test error";
      result.current.clearError();
      result.current.clearAuth();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.accessToken).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
