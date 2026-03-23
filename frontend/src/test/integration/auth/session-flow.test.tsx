import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import MockAdapter from "axios-mock-adapter";

import apiClient from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import LoginPage from "@/pages/LoginPage";
import SessionManager from "@/components/SessionManager";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const mockUser = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  is_admin: false,
};

describe("Session Flow Integration Tests", () => {
  let mockAxios: MockAdapter;
  let user: ReturnType<typeof userEvent.setup>;
  let assignMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAxios = new MockAdapter(apiClient);
    user = userEvent.setup();
    assignMock = vi.fn();

    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost/login",
        pathname: "/login",
        assign: assignMock,
        replace: vi.fn(),
        reload: vi.fn(),
      },
      writable: true,
    });

    useAuthStore.getState().clearAuth();
    localStorage.clear();
    window.confirm = vi.fn();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    (window as unknown as { __authStore?: unknown }).__authStore = {
      getState: useAuthStore.getState,
      refreshToken: useAuthStore.getState().refreshToken,
      clearAuth: useAuthStore.getState().clearAuth,
    };
  });

  afterEach(() => {
    mockAxios.restore();
    vi.restoreAllMocks();
  });

  it("requests the Casdoor login url and redirects", async () => {
    mockAxios.onPost("/auth/refresh").reply(401, {});
    mockAxios.onGet("/auth/login").reply((config) => [
      200,
      {
        url: `https://casdoor.example/login?next=${config.params.next as string}`,
      },
    ]);

    render(
      <TestWrapper>
        <LoginPage />
      </TestWrapper>,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue with Casdoor" }),
    );

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        "https://casdoor.example/login?next=/admin",
      );
    });

    expect(mockAxios.history.get[0]?.url).toBe("/auth/login");
    expect(mockAxios.history.get[0]?.params).toMatchObject({ next: "/admin" });
  });

  it("refreshes an expired session during checkAuth", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("expired-token", 900);
    authStore.setUser(mockUser);
    useAuthStore.setState({ tokenExpiry: Date.now() - 1000 });

    mockAxios.onPost("/auth/refresh").reply(200, {
      access_token: "refreshed-token",
      expires_in: 900,
      user: mockUser,
    });
    mockAxios.onGet("/auth/me").reply(200, mockUser);

    await authStore.checkAuth();

    expect(mockAxios.history.post[0]?.url).toBe("/auth/refresh");
    expect(
      mockAxios.history.get.some((request) => request.url === "/auth/me"),
    ).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("refreshed-token");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("retries auth state after a refreshed /auth/me failure", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("valid-token", 900);

    mockAxios.onGet("/auth/me").replyOnce(401, { detail: "Expired" });
    mockAxios.onPost("/auth/refresh").reply(200, {
      access_token: "new-token",
      expires_in: 900,
      user: mockUser,
    });
    mockAxios.onGet("/auth/me").reply(200, mockUser);

    await authStore.checkAuth();

    expect(useAuthStore.getState().accessToken).toBe("new-token");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(
      mockAxios.history.get.filter((request) => request.url === "/auth/me"),
    ).toHaveLength(2);
  });

  it("clears auth state when refresh fails", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("expired-token", 900);
    authStore.setUser(mockUser);
    useAuthStore.setState({ tokenExpiry: Date.now() - 1000 });

    mockAxios.onPost("/auth/refresh").reply(401, { detail: "Expired" });

    await authStore.checkAuth();

    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.user).toBeNull();
    expect(authStore.accessToken).toBeNull();
  });

  it("logs out the current session through the store", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("valid-token", 900);
    authStore.setUser(mockUser);
    mockAxios.onPost("/auth/logout").reply(200, {});

    await authStore.logout();

    expect(
      mockAxios.history.post.some((request) => request.url === "/auth/logout"),
    ).toBe(true);
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.user).toBeNull();
  });

  it("logs out every session from the session manager", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("valid-token", 900);
    authStore.setUser(mockUser);
    mockAxios.onPost("/auth/revoke-all-sessions").reply(200, {});
    window.confirm = vi.fn().mockReturnValue(true);

    render(
      <TestWrapper>
        <SessionManager />
      </TestWrapper>,
    );

    await user.click(screen.getByText(/logout from all devices/i));

    await waitFor(() => {
      expect(authStore.isAuthenticated).toBe(false);
    });

    expect(
      mockAxios.history.post.some(
        (request) => request.url === "/auth/revoke-all-sessions",
      ),
    ).toBe(true);
  });
});
