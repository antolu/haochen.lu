import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
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

const TestWrapper: React.FC<{
  children: React.ReactNode;
  initialEntries?: string[];
}> = ({ children, initialEntries = ["/"] }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const TestDashboard: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div>
      <h1>Dashboard</h1>
      <p data-testid="welcome-message">Welcome, {user?.username}!</p>
      <SessionManager />
    </div>
  );
};

const TestApp: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <TestDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <TestDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
};

const mockUser = {
  id: "1",
  username: "testuser",
  email: "test@example.com",
  is_admin: false,
};

describe("Auth Components Integration Tests", () => {
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
    window.confirm = vi.fn();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    (window as unknown as { __authStore?: unknown }).__authStore = {
      getState: useAuthStore.getState,
      refreshToken: useAuthStore.getState().refreshToken,
      clearAuth: useAuthStore.getState().clearAuth,
    };

    mockAxios.onPost("/auth/refresh").reply(401, { detail: "No session" });
  });

  afterEach(() => {
    mockAxios.restore();
    vi.restoreAllMocks();
  });

  it("renders the current SSO login experience", async () => {
    render(
      <TestWrapper initialEntries={["/login"]}>
        <LoginPage />
      </TestWrapper>,
    );

    expect(screen.getByText("Portfolio Login")).toBeInTheDocument();
    expect(
      screen.getByText("Use Casdoor SSO to access the admin area."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Casdoor" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Return to Gallery")).toBeInTheDocument();
  });

  it("starts the Casdoor login redirect with the current route state", async () => {
    mockAxios.onGet("/auth/login").reply((config) => [
      200,
      {
        url: `https://casdoor.example/login?${config.params.next ? `next=${config.params.next}` : ""}`,
      },
    ]);

    render(
      <TestWrapper initialEntries={["/login?next=/admin/subapps"]}>
        <LoginPage />
      </TestWrapper>,
    );

    await user.click(
      screen.getByRole("button", { name: "Continue with Casdoor" }),
    );

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        "https://casdoor.example/login?next=/admin/subapps",
      );
    });

    expect(mockAxios.history.get).toHaveLength(1);
    expect(mockAxios.history.get[0]?.url).toBe("/auth/login");
    expect(mockAxios.history.get[0]?.params).toMatchObject({
      next: "/admin/subapps",
    });
  });

  it("redirects protected routes to the current login page", () => {
    render(
      <TestWrapper initialEntries={["/dashboard"]}>
        <TestApp />
      </TestWrapper>,
    );

    expect(screen.getByText("Portfolio Login")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("allows authenticated users to reach the dashboard", () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("valid-token", 900);
    authStore.setUser(mockUser);

    render(
      <TestWrapper initialEntries={["/dashboard"]}>
        <TestApp />
      </TestWrapper>,
    );

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("welcome-message")).toHaveTextContent(
      "Welcome, testuser!",
    );
  });

  it("logs out the current session from the session manager", async () => {
    const authStore = useAuthStore.getState();
    authStore.setTokens("valid-token", 900);
    authStore.setUser(mockUser);
    mockAxios.onPost("/auth/logout").reply(200, {});

    render(
      <TestWrapper initialEntries={["/dashboard"]}>
        <TestApp />
      </TestWrapper>,
    );

    await user.click(screen.getByText(/^logout$/i));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(screen.getByText("Portfolio Login")).toBeInTheDocument();
    });

    expect(
      mockAxios.history.post.some((request) => request.url === "/auth/logout"),
    ).toBe(true);
  });

  it("revokes all sessions after confirmation", async () => {
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
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    expect(window.confirm).toHaveBeenCalledWith(
      "This will log you out of all devices. Continue?",
    );
    expect(
      mockAxios.history.post.some(
        (request) => request.url === "/auth/revoke-all-sessions",
      ),
    ).toBe(true);
  });
});
