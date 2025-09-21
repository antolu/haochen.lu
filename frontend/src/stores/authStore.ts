import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { auth } from '../api/client';
import type { User, LoginRequest } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;
  tokenExpiry: number | null;
  isRefreshing: boolean;

  // Actions
  login: (credentials: LoginRequest, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
  setTokens: (accessToken: string, expiresIn: number) => void;
  setUser: (user: User | null) => void;
  clearAuth: () => void;
  isTokenExpired: () => boolean;
  logoutEverywhere: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      accessToken: null,
      tokenExpiry: null,
      isRefreshing: false,

      login: async (credentials: LoginRequest, rememberMe = false) => {
        set({ isLoading: true, error: null });

        try {
          const tokenResponse = await auth.login({ ...credentials, remember_me: rememberMe });

          set({
            accessToken: tokenResponse.access_token,
            tokenExpiry: Date.now() + tokenResponse.expires_in * 1000,
          });

          // Get user info
          const user = await auth.getMe();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          let errorMessage = 'Login failed';

          if (error.response?.data?.detail) {
            errorMessage = error.response.data.detail;
          } else if (error.response?.status === 401) {
            errorMessage = 'Invalid username or password';
          } else if (error.response?.status === 403) {
            errorMessage = 'Access denied';
          } else if (error.response?.status >= 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.code === 'NETWORK_ERROR' || !error.response) {
            errorMessage = 'Network error. Please check your connection.';
          }

          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
            accessToken: null,
            tokenExpiry: null,
          });
          throw error;
        }
      },

      logout: async () => {
        try {
          await auth.logout();
        } catch (error) {
          console.warn('Logout request failed:', error);
        } finally {
          get().clearAuth();
        }
      },

      logoutEverywhere: async () => {
        try {
          await auth.revokeAllSessions();
        } catch (error) {
          console.warn('Logout everywhere request failed:', error);
        } finally {
          get().clearAuth();
        }
      },

      refreshToken: async (): Promise<boolean> => {
        const { isRefreshing } = get();

        // Prevent multiple simultaneous refresh attempts
        if (isRefreshing) {
          return false;
        }

        set({ isRefreshing: true });

        try {
          const response = await auth.refresh();
          const { access_token, expires_in, user } = response;

          set({
            accessToken: access_token,
            user,
            isAuthenticated: true,
            tokenExpiry: Date.now() + expires_in * 1000,
            isRefreshing: false,
            error: null,
          });

          return true;
        } catch (error) {
          console.warn('Token refresh failed:', error);
          get().clearAuth();
          return false;
        } finally {
          set({ isRefreshing: false });
        }
      },

      setTokens: (accessToken: string, expiresIn: number) => {
        set({
          accessToken,
          tokenExpiry: Date.now() + expiresIn * 1000,
          isAuthenticated: true,
        });
      },

      setUser: (user: User | null) => {
        set({ user });
      },

      clearAuth: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
          accessToken: null,
          tokenExpiry: null,
          isRefreshing: false,
        });
      },

      isTokenExpired: (): boolean => {
        const { tokenExpiry } = get();
        if (!tokenExpiry) return true;
        return Date.now() >= tokenExpiry - 60000; // Refresh 1 minute before expiry
      },

      checkAuth: async () => {
        // First check if we have a valid access token
        const { accessToken, isTokenExpired, refreshToken } = get();

        if (!accessToken || isTokenExpired()) {
          // Try to refresh the token using the HttpOnly cookie
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            set({ isAuthenticated: false, user: null });
            return;
          }
        }

        set({ isLoading: true });

        try {
          const user = await auth.getMe();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // If /me fails, try to refresh and retry once
          const refreshSuccess = await get().refreshToken();
          if (refreshSuccess) {
            try {
              const user = await auth.getMe();
              set({
                user,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return;
            } catch (retryError) {
              console.warn('Retry after refresh also failed:', retryError);
            }
          }

          get().clearAuth();
          set({ isLoading: false });
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-store',
      // Only persist user and authentication state, not tokens (they come from cookies)
      partialize: state => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Make auth store available globally for API client
(window as any).__authStore = useAuthStore;
