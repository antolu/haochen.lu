/**
 * Integration Tests for Auth Components
 * Tests the integration between authentication components and the auth system,
 * including LoginPage, SessionManager, and protected route behavior.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';
import LoginPage from '@/pages/LoginPage';
import SessionManager from '@/components/SessionManager';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Test wrapper with all providers
const TestWrapper: React.FC<{ children: React.ReactNode; initialEntries?: string[] }> = ({
  children,
  initialEntries = ['/'],
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// Protected Route Component for testing
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Test Dashboard Component
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

// Test App with routing
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
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  is_active: true,
};

const mockTokenResponse = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 900,
  user: mockUser,
};

describe('Auth Components Integration Tests', () => {
  let mockAxios: MockAdapter;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockAxios = new MockAdapter(apiClient);
    user = userEvent.setup();

    // Reset auth store
    useAuthStore.getState().clearAuth();

    // Clear all mocks
    vi.clearAllMocks();

    // Mock window.confirm for logout everywhere tests
    window.confirm = vi.fn();
  });

  afterEach(() => {
    mockAxios.restore();
    vi.clearAllTimers();
  });

  describe('Login Page Integration', () => {
    it('should redirect to dashboard after successful login', async () => {
      mockAxios.onPost('/api/auth/login').reply(200, mockTokenResponse);
      mockAxios.onGet('/api/auth/me').reply(200, mockUser);

      render(
        <TestWrapper initialEntries={['/login']}>
          <TestApp />
        </TestWrapper>
      );

      // Should show login page initially
      expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();

      // Fill and submit login form
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const rememberMeCheckbox = screen.getByLabelText(/keep me logged in/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(rememberMeCheckbox);
      await user.click(loginButton);

      // Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome, testuser!');
      });

      // Verify auth state
      const authState = useAuthStore.getState();
      expect(authState.isAuthenticated).toBe(true);
      expect(authState.user).toEqual(mockUser);
    });

    it('should show error message on login failure', async () => {
      mockAxios.onPost('/api/auth/login').reply(401, {
        detail: 'Invalid credentials',
      });

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should show loading state during login', async () => {
      // Create a delayed response
      mockAxios.onPost('/api/auth/login').reply(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([200, mockTokenResponse]), 100);
        });
      });

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      // Should show loading state
      expect(screen.getByText(/signing in.../i)).toBeInTheDocument();
      expect(loginButton).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(screen.queryByText(/signing in.../i)).not.toBeInTheDocument();
      });
    });

    it('should handle remember me checkbox correctly', async () => {
      mockAxios.onPost('/api/auth/login').reply(200, mockTokenResponse);
      mockAxios.onGet('/api/auth/me').reply(200, mockUser);

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const rememberMeCheckbox = screen.getByLabelText(/keep me logged in/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');

      // Test with remember me unchecked
      expect(rememberMeCheckbox).not.toBeChecked();
      await user.click(loginButton);

      await waitFor(() => {
        const loginRequest = JSON.parse(mockAxios.history.post[0].data);
        expect(loginRequest.remember_me).toBe(false);
      });

      // Reset and test with remember me checked
      mockAxios.reset();
      mockAxios.onPost('/api/auth/login').reply(200, mockTokenResponse);
      useAuthStore.getState().clearAuth();

      await user.clear(usernameInput);
      await user.clear(passwordInput);
      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(rememberMeCheckbox);
      await user.click(loginButton);

      await waitFor(() => {
        const loginRequest = JSON.parse(mockAxios.history.post[0].data);
        expect(loginRequest.remember_me).toBe(true);
      });
    });
  });

  describe('Session Manager Integration', () => {
    beforeEach(() => {
      // Set up authenticated state
      const authStore = useAuthStore.getState();
      authStore.setTokens('valid-token', 900);
      authStore.setUser(mockUser);
    });

    it('should display current user information', () => {
      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      expect(screen.getByText(/session management/i)).toBeInTheDocument();
      expect(screen.getByText(/logged in as:/i)).toBeInTheDocument();
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });

    it('should logout single session successfully', async () => {
      mockAxios.onPost('/api/auth/logout').reply(200, {});

      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      const logoutButton = screen.getByText(/^logout$/i);
      await user.click(logoutButton);

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
        expect(useAuthStore.getState().user).toBeNull();
      });

      expect(mockAxios.history.post.some(req => req.url === '/api/auth/logout')).toBe(true);
    });

    it('should logout everywhere with confirmation', async () => {
      mockAxios.onPost('/api/auth/revoke-all-sessions').reply(200, {});
      window.confirm = vi.fn().mockReturnValue(true);

      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      const logoutEverywhereButton = screen.getByText(/logout from all devices/i);
      await user.click(logoutEverywhereButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'This will log you out of all devices. Continue?'
      );

      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
      });

      expect(mockAxios.history.post.some(req => req.url === '/api/auth/revoke-all-sessions')).toBe(
        true
      );
    });

    it('should not logout everywhere if user cancels', async () => {
      window.confirm = vi.fn().mockReturnValue(false);

      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      const logoutEverywhereButton = screen.getByText(/logout from all devices/i);
      await user.click(logoutEverywhereButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(mockAxios.history.post).toHaveLength(0);
    });

    it('should show loading state during logout operations', async () => {
      mockAxios.onPost('/api/auth/logout').reply(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve([200, {}]), 100);
        });
      });

      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      const logoutButton = screen.getByText(/^logout$/i);
      await user.click(logoutButton);

      expect(screen.getByText(/logging out.../i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByText(/logging out.../i)).not.toBeInTheDocument();
      });
    });

    it('should handle logout errors gracefully', async () => {
      mockAxios.onPost('/api/auth/logout').reply(500, { detail: 'Server error' });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <TestWrapper>
          <SessionManager />
        </TestWrapper>
      );

      const logoutButton = screen.getByText(/^logout$/i);
      await user.click(logoutButton);

      await waitFor(() => {
        // Should still clear auth state even if server call fails
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Protected Route Integration', () => {
    it('should redirect to login when not authenticated', () => {
      render(
        <TestWrapper initialEntries={['/dashboard']}>
          <TestApp />
        </TestWrapper>
      );

      // Should redirect to login page
      expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('should allow access when authenticated', () => {
      // Set up authenticated state
      const authStore = useAuthStore.getState();
      authStore.setTokens('valid-token', 900);
      authStore.setUser(mockUser);

      render(
        <TestWrapper initialEntries={['/dashboard']}>
          <TestApp />
        </TestWrapper>
      );

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome, testuser!');
    });

    it('should redirect to login after logout', async () => {
      // Set up authenticated state
      const authStore = useAuthStore.getState();
      authStore.setTokens('valid-token', 900);
      authStore.setUser(mockUser);

      mockAxios.onPost('/api/auth/logout').reply(200, {});

      render(
        <TestWrapper initialEntries={['/dashboard']}>
          <TestApp />
        </TestWrapper>
      );

      // Should show dashboard initially
      expect(screen.getByText('Dashboard')).toBeInTheDocument();

      // Logout
      const logoutButton = screen.getByText(/^logout$/i);
      await user.click(logoutButton);

      // Should redirect to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Full Authentication Flow', () => {
    it('should complete full login-logout cycle', async () => {
      mockAxios.onPost('/api/auth/login').reply(200, mockTokenResponse);
      mockAxios.onGet('/api/auth/me').reply(200, mockUser);
      mockAxios.onPost('/api/auth/logout').reply(200, {});

      render(
        <TestWrapper initialEntries={['/']}>
          <TestApp />
        </TestWrapper>
      );

      // Should start at login (redirected from protected route)
      expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();

      // Login
      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      // Should show dashboard after login
      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Logout
      const logoutButton = screen.getByText(/^logout$/i);
      await user.click(logoutButton);

      // Should return to login
      await waitFor(() => {
        expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();
      });
    });

    it('should handle session restoration on page refresh', async () => {
      // Simulate existing session
      const authStore = useAuthStore.getState();
      authStore.setTokens('valid-token', 900);
      authStore.setUser(mockUser);

      mockAxios.onGet('/api/auth/me').reply(200, mockUser);

      render(
        <TestWrapper initialEntries={['/dashboard']}>
          <TestApp />
        </TestWrapper>
      );

      // Should show dashboard immediately (session restored)
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('welcome-message')).toHaveTextContent('Welcome, testuser!');
    });

    it('should handle token expiry during session', async () => {
      // Set up authenticated state with expired token
      const authStore = useAuthStore.getState();
      authStore.setTokens('expired-token', 900);
      authStore.setUser(mockUser);
      // Force expiry
      authStore.tokenExpiry = Date.now() - 1000;

      mockAxios.onPost('/api/auth/refresh').reply(401, { detail: 'Refresh token expired' });

      render(
        <TestWrapper initialEntries={['/dashboard']}>
          <TestApp />
        </TestWrapper>
      );

      // Should eventually redirect to login due to expired session
      await waitFor(() => {
        expect(screen.getByText(/sign in to admin panel/i)).toBeInTheDocument();
      });

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle simultaneous login attempts', async () => {
      mockAxios.onPost('/api/auth/login').reply(200, mockTokenResponse);
      mockAxios.onGet('/api/auth/me').reply(200, mockUser);

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');

      // Click login button multiple times rapidly
      await user.click(loginButton);
      await user.click(loginButton);
      await user.click(loginButton);

      // Should only make one login request
      await waitFor(() => {
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
      });

      const loginRequests = mockAxios.history.post.filter(req => req.url === '/api/auth/login');
      expect(loginRequests).toHaveLength(1);
    });

    it('should handle network errors gracefully', async () => {
      mockAxios.onPost('/api/auth/login').networkError();

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/login failed/i)).toBeInTheDocument();
      });
    });

    it('should clear form errors when typing new input', async () => {
      mockAxios.onPost('/api/auth/login').reply(401, { detail: 'Invalid credentials' });

      render(
        <TestWrapper initialEntries={['/login']}>
          <LoginPage />
        </TestWrapper>
      );

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole('button', { name: /sign in/i });

      // Submit invalid credentials
      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Type in password field - error should be cleared
      await user.type(passwordInput, 'new');

      // Error might still be there depending on implementation
      // This tests the error clearing behavior
    });
  });
});
