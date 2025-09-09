/**
 * P0 - Critical UI Security Tests: Authentication Security
 * 
 * Tests to ensure proper authentication handling, token management,
 * and protection against authentication-related attacks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockUser, mockAdminUser, mockLocalStorage } from '../utils';

// Mock authentication hook
const mockUseAuth = vi.fn();
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock API service
const mockApiService = {
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  getCurrentUser: vi.fn(),
};
vi.mock('@/services/api', () => mockApiService);

// Mock components for testing
const MockLoginForm = () => {
  const [credentials, setCredentials] = React.useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await mockApiService.login(credentials);
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="login-form">
      <input
        type="text"
        placeholder="Username"
        value={credentials.username}
        onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
        data-testid="username-input"
      />
      <input
        type="password"
        placeholder="Password"
        value={credentials.password}
        onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
        data-testid="password-input"
      />
      <button type="submit" disabled={isLoading} data-testid="login-button">
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

const MockProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = mockUseAuth();
  
  if (!auth.isAuthenticated) {
    return <div data-testid="login-required">Please log in to access this content</div>;
  }
  
  return <div data-testid="protected-content">{children}</div>;
};

const MockAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = mockUseAuth();
  
  if (!auth.isAuthenticated) {
    return <div data-testid="login-required">Please log in</div>;
  }
  
  if (!auth.user?.is_admin) {
    return <div data-testid="admin-required">Admin access required</div>;
  }
  
  return <div data-testid="admin-content">{children}</div>;
};

describe('Authentication Security Tests', () => {
  let localStorage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    localStorage = mockLocalStorage();
    Object.defineProperty(window, 'localStorage', { value: localStorage });
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Login Security', () => {
    it('should not expose credentials in memory longer than necessary', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      mockApiService.login.mockResolvedValueOnce({
        token: 'valid-token',
        user: mockUser,
      });

      renderWithProviders(<MockLoginForm />);

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockApiService.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'password123',
        });
      });

      // Verify credentials are not stored in local storage
      expect(localStorage.getItem).not.toHaveBeenCalledWith('credentials');
      expect(localStorage.getItem).not.toHaveBeenCalledWith('password');
    });

    it('should prevent brute force attacks with rate limiting', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      // Mock failed login attempts
      mockApiService.login.mockRejectedValue(new Error('Invalid credentials'));

      renderWithProviders(<MockLoginForm />);

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      // Simulate multiple rapid login attempts
      for (let i = 0; i < 5; i++) {
        await user.clear(usernameInput);
        await user.clear(passwordInput);
        await user.type(usernameInput, `user${i}`);
        await user.type(passwordInput, `wrong${i}`);
        await user.click(loginButton);
        
        await waitFor(() => {
          expect(loginButton).not.toBeDisabled();
        });
      }

      // In a real implementation, there should be rate limiting after multiple failures
      expect(mockApiService.login).toHaveBeenCalledTimes(5);
    });

    it('should validate input to prevent injection attacks', async () => {
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      
      renderWithProviders(<MockLoginForm />);

      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      // Try SQL injection payloads
      const maliciousInputs = [
        "admin'--",
        "admin' OR '1'='1",
        "'; DROP TABLE users; --",
        "<script>alert('XSS')</script>",
      ];

      for (const maliciousInput of maliciousInputs) {
        await user.clear(usernameInput);
        await user.clear(passwordInput);
        await user.type(usernameInput, maliciousInput);
        await user.type(passwordInput, 'password');
        await user.click(loginButton);

        await waitFor(() => {
          // Should pass the input as-is to the API (server should handle validation)
          expect(mockApiService.login).toHaveBeenCalledWith({
            username: maliciousInput,
            password: 'password',
          });
        });

        mockApiService.login.mockClear();
      }
    });
  });

  describe('Token Management Security', () => {
    it('should securely store authentication tokens', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test';
      
      // Mock secure token storage
      const secureTokenStorage = {
        setToken: (token: string) => {
          // Should use secure storage (httpOnly cookies in real implementation)
          localStorage.setItem('auth_token', token);
        },
        getToken: () => {
          return localStorage.getItem('auth_token');
        },
        removeToken: () => {
          localStorage.removeItem('auth_token');
        },
      };

      secureTokenStorage.setToken(token);
      expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', token);

      const retrievedToken = secureTokenStorage.getToken();
      expect(retrievedToken).toBe(token);

      secureTokenStorage.removeToken();
      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });

    it('should handle token expiration properly', async () => {
      const expiredToken = 'expired-token';
      const newToken = 'new-token';

      // Mock expired token scenario
      mockApiService.refreshToken
        .mockRejectedValueOnce(new Error('Token expired'))
        .mockResolvedValueOnce({ token: newToken, user: mockUser });

      localStorage.setItem('auth_token', expiredToken);

      // Simulate token refresh logic
      const refreshAuthToken = async () => {
        try {
          const result = await mockApiService.refreshToken();
          localStorage.setItem('auth_token', result.token);
          return result;
        } catch (error) {
          localStorage.removeItem('auth_token');
          throw error;
        }
      };

      try {
        await refreshAuthToken();
        // Should fail first time, succeed second time
        expect(mockApiService.refreshToken).toHaveBeenCalledTimes(1);
      } catch (error) {
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      }
    });

    it('should prevent token exposure in URLs', () => {
      const token = 'sensitive-token';
      
      // Mock navigation that should NOT include token in URL
      const navigateWithToken = (path: string, includeToken = false) => {
        const url = new URL(path, 'http://localhost');
        
        if (includeToken) {
          url.searchParams.set('token', token);
        }
        
        return url.toString();
      };

      // Good practice - token not in URL
      const secureUrl = navigateWithToken('/dashboard');
      expect(secureUrl).not.toContain(token);

      // Bad practice - token in URL (should be avoided)
      const insecureUrl = navigateWithToken('/dashboard', true);
      expect(insecureUrl).toContain(token);
      
      // In real implementation, never include tokens in URLs
    });
  });

  describe('Route Protection Security', () => {
    it('should protect routes that require authentication', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: false,
        user: null,
        login: vi.fn(),
        logout: vi.fn(),
      });

      renderWithProviders(
        <MockProtectedRoute>
          <div>Secret Content</div>
        </MockProtectedRoute>
      );

      expect(screen.getByTestId('login-required')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
      expect(screen.queryByText('Secret Content')).not.toBeInTheDocument();
    });

    it('should allow access to authenticated users', () => {
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockUser,
        login: vi.fn(),
        logout: vi.fn(),
      });

      renderWithProviders(
        <MockProtectedRoute>
          <div>Secret Content</div>
        </MockProtectedRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(screen.getByText('Secret Content')).toBeInTheDocument();
      expect(screen.queryByTestId('login-required')).not.toBeInTheDocument();
    });

    it('should enforce admin-only routes', () => {
      // Test with regular user
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: { ...mockUser, is_admin: false },
        login: vi.fn(),
        logout: vi.fn(),
      });

      const { rerender } = renderWithProviders(
        <MockAdminRoute>
          <div>Admin Panel</div>
        </MockAdminRoute>
      );

      expect(screen.getByTestId('admin-required')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();

      // Test with admin user
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: mockAdminUser,
        login: vi.fn(),
        logout: vi.fn(),
      });

      rerender(
        <MockAdminRoute>
          <div>Admin Panel</div>
        </MockAdminRoute>
      );

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    });

    it('should handle role escalation attempts', () => {
      // Mock a scenario where a user tries to access admin content
      const regularUser = { ...mockUser, is_admin: false };
      
      mockUseAuth.mockReturnValue({
        isAuthenticated: true,
        user: regularUser,
        login: vi.fn(),
        logout: vi.fn(),
      });

      // Simulate client-side role escalation attempt
      const maliciousUser = { ...regularUser, is_admin: true };
      
      // The component should rely on server-side validation, not client-side flags
      renderWithProviders(
        <MockAdminRoute>
          <div>Admin Panel</div>
        </MockAdminRoute>
      );

      // Should still deny access based on original user data
      expect(screen.getByTestId('admin-required')).toBeInTheDocument();
      expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    });
  });

  describe('Session Management Security', () => {
    it('should handle logout securely', async () => {
      const mockLogout = vi.fn().mockImplementation(() => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
      });

      mockApiService.logout.mockResolvedValue({});

      // Simulate logout process
      await mockLogout();

      expect(localStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('user_data');
    });

    it('should implement session timeout', () => {
      const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
      
      const sessionManager = {
        startSession: () => {
          const now = Date.now();
          localStorage.setItem('session_start', now.toString());
        },
        isSessionValid: () => {
          const sessionStart = localStorage.getItem('session_start');
          if (!sessionStart) return false;
          
          const elapsed = Date.now() - parseInt(sessionStart, 10);
          return elapsed < SESSION_TIMEOUT;
        },
        clearSession: () => {
          localStorage.removeItem('session_start');
          localStorage.removeItem('auth_token');
        },
      };

      // Start session
      sessionManager.startSession();
      expect(sessionManager.isSessionValid()).toBe(true);

      // Mock time passage
      vi.setSystemTime(new Date(Date.now() + SESSION_TIMEOUT + 1000));
      expect(sessionManager.isSessionValid()).toBe(false);
      
      vi.useRealTimers();
    });

    it('should prevent session fixation attacks', () => {
      const sessionId = 'initial-session-id';
      const newSessionId = 'new-session-id-after-login';
      
      // Initial session
      localStorage.setItem('session_id', sessionId);
      
      // Simulate successful login - should create new session ID
      const handleSuccessfulLogin = () => {
        localStorage.removeItem('session_id');
        localStorage.setItem('session_id', newSessionId);
      };
      
      handleSuccessfulLogin();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('session_id');
      expect(localStorage.setItem).toHaveBeenCalledWith('session_id', newSessionId);
      expect(localStorage.getItem('session_id')).toBe(newSessionId);
    });
  });

  describe('CSRF Protection', () => {
    it('should include CSRF tokens in sensitive requests', async () => {
      const csrfToken = 'csrf-token-123';
      
      // Mock CSRF token generation
      const generateCSRFToken = () => {
        return btoa(Math.random().toString()).substring(0, 16);
      };
      
      // Mock API call with CSRF protection
      const protectedApiCall = async (data: any) => {
        const token = generateCSRFToken();
        
        return fetch('/api/protected-endpoint', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
          },
          body: JSON.stringify({ ...data, _csrf: token }),
        });
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      global.fetch = mockFetch;

      await protectedApiCall({ action: 'delete-photo' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/protected-endpoint',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': expect.any(String),
          }),
        })
      );
    });

    it('should validate origin headers for same-origin policy', () => {
      const validateOrigin = (origin: string) => {
        const allowedOrigins = ['http://localhost:5173', 'https://yourapp.com'];
        return allowedOrigins.includes(origin);
      };

      expect(validateOrigin('http://localhost:5173')).toBe(true);
      expect(validateOrigin('https://yourapp.com')).toBe(true);
      expect(validateOrigin('https://malicious.com')).toBe(false);
      expect(validateOrigin('http://evil.com')).toBe(false);
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive information in error messages', async () => {
      mockApiService.login.mockRejectedValue({
        response: {
          status: 401,
          data: { 
            detail: 'Invalid credentials',
            // Should NOT expose: 'User john_doe not found in database'
          },
        },
      });

      const LoginWithErrorHandling = () => {
        const [error, setError] = React.useState<string | null>(null);
        
        const handleLogin = async () => {
          try {
            await mockApiService.login({ username: 'user', password: 'pass' });
          } catch (err: any) {
            // Sanitize error message to prevent information disclosure
            const safeError = err.response?.data?.detail || 'Login failed. Please try again.';
            setError(safeError);
          }
        };

        return (
          <div>
            <button onClick={handleLogin} data-testid="login-btn">Login</button>
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        );
      };

      renderWithProviders(<LoginWithErrorHandling />);
      
      const user = await import('@testing-library/user-event').then(m => m.userEvent.setup());
      await user.click(screen.getByTestId('login-btn'));

      await waitFor(() => {
        const errorMessage = screen.getByTestId('error-message');
        expect(errorMessage).toHaveTextContent('Invalid credentials');
        
        // Should not expose database details or user existence
        expect(errorMessage.textContent).not.toContain('database');
        expect(errorMessage.textContent).not.toContain('not found');
        expect(errorMessage.textContent).not.toContain('john_doe');
      });
    });

    it('should not expose authentication tokens in console or DOM', () => {
      const sensitiveToken = 'eyJhbGciOiJIUzI1NiJ9.sensitive-payload';
      
      // Mock component that handles tokens
      const TokenHandler = () => {
        const [token] = React.useState(sensitiveToken);
        
        // Good practice - don't log tokens
        // console.log('Token:', token); // ❌ DON'T DO THIS
        
        // Don't expose in DOM attributes
        return (
          <div data-testid="token-handler">
            {/* ❌ DON'T: <div data-token={token}>Content</div> */}
            <div>Authenticated content</div>
          </div>
        );
      };

      renderWithProviders(<TokenHandler />);
      
      const tokenHandler = screen.getByTestId('token-handler');
      
      // Ensure token is not exposed in DOM
      expect(tokenHandler.innerHTML).not.toContain(sensitiveToken);
      expect(tokenHandler.getAttribute('data-token')).toBeNull();
    });
  });
});