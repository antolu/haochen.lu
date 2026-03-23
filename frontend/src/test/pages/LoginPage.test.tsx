import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../../pages/LoginPage";

const { authorizeMock, loginMock, checkAuthMock, clearErrorMock, assignMock } =
  vi.hoisted(() => ({
    authorizeMock: vi.fn(),
    loginMock: vi.fn(),
    checkAuthMock: vi.fn(),
    clearErrorMock: vi.fn(),
    assignMock: vi.fn(),
  }));

vi.mock("../../api/client", () => ({
  auth: {
    authorize: authorizeMock,
    login: loginMock,
  },
}));

vi.mock("../../stores/authStore", () => ({
  useAuthStore: vi.fn(() => ({
    isAuthenticated: true,
    error: null,
    clearError: clearErrorMock,
    isLoading: false,
    checkAuth: checkAuthMock,
  })),
}));

describe("LoginPage", () => {
  beforeEach(() => {
    authorizeMock.mockReset();
    loginMock.mockReset();
    checkAuthMock.mockReset();
    clearErrorMock.mockReset();
    authorizeMock.mockResolvedValue({
      url: "https://sub.example.com/callback?code=1",
    });
    assignMock.mockReset();
    vi.stubGlobal("location", { assign: assignMock });
  });

  it("continues directly to subapp authorization when already authenticated", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/login?client_id=subapp-1&redirect_uri=https%3A%2F%2Fsub.example.com%2Fcallback&response_type=code&state=state-1",
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(authorizeMock).toHaveBeenCalledWith({
        client_id: "subapp-1",
        redirect_uri: "https://sub.example.com/callback",
        response_type: "code",
        state: "state-1",
      });
    });

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith(
        "https://sub.example.com/callback?code=1",
      );
    });
  });
});
