/**
 * Unit Tests for API Client Interceptors
 * Tests the automatic token refresh, request queuing, and cookie-based
 * authentication features of the API client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { AxiosError } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { apiClient } from '@/api/client';

// Mock the global auth store
const mockAuthStore = {
  getState: vi.fn(),
  subscribe: vi.fn(),
  setState: vi.fn(),
};

const mockAuthState = {
  accessToken: 'valid-token',
  refreshToken: vi.fn(),
  clearAuth: vi.fn(),
  isRefreshing: false,
};

// Set up global auth store mock
beforeEach(() => {
  (window as any).__authStore = mockAuthStore;
  mockAuthStore.getState.mockReturnValue(mockAuthState);
  vi.clearAllMocks();
});

describe('API Client Interceptors', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(apiClient);
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.restore();
    vi.clearAllTimers();
  });

  describe('Request Interceptor', () => {
    it('should add Bearer token to requests when token is available', async () => {
      const token = 'test-access-token';
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        accessToken: token,
      });

      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await apiClient.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not add Authorization header when no token is available', async () => {
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        accessToken: null,
      });

      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await apiClient.get('/test');

      const request = mockAxios.history.get[0];
      expect(request.headers?.Authorization).toBeUndefined();
    });

    it('should include withCredentials for cookie support', async () => {
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await apiClient.get('/test');

      const request = mockAxios.history.get[0];
      // The withCredentials should be set in the axios instance config
      expect(apiClient.defaults.withCredentials).toBe(true);
    });
  });

  describe('Response Interceptor - Token Refresh', () => {
    it('should refresh token on 401 error and retry request', async () => {
      const originalToken = 'expired-token';
      const newToken = 'refreshed-token';

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        accessToken: originalToken,
        refreshToken: vi.fn().mockResolvedValue(true),
      });

      // First request fails with 401
      mockAxios.onGet('/test').replyOnce(401, { detail: 'Token expired' });
      // Retry with new token succeeds
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const result = await apiClient.get('/test');

      expect(mockAuthState.refreshToken).toHaveBeenCalled();
      expect(result.data).toEqual({ data: 'success' });
      expect(mockAxios.history.get).toHaveLength(2); // Original + retry
    });

    it('should clear auth and redirect on refresh failure', async () => {
      const mockClearAuth = vi.fn();

      // Mock location for redirect test
      const mockLocation = {
        pathname: '/dashboard',
        href: '',
      };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        clearAuth: mockClearAuth,
        refreshToken: vi.fn().mockResolvedValue(false), // Refresh fails
      });

      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockClearAuth).toHaveBeenCalled();
        expect(mockLocation.href).toBe('/login');
      }
    });

    it('should queue requests during token refresh', async () => {
      let refreshResolve: (value: boolean) => void;
      const refreshPromise = new Promise<boolean>(resolve => {
        refreshResolve = resolve;
      });

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: vi.fn().mockReturnValue(refreshPromise),
      });

      // Both requests fail with 401 initially
      mockAxios.onGet('/test1').replyOnce(401).onGet('/test1').reply(200, { data: 'test1' });
      mockAxios.onGet('/test2').replyOnce(401).onGet('/test2').reply(200, { data: 'test2' });

      // Start both requests simultaneously
      const request1Promise = apiClient.get('/test1');
      const request2Promise = apiClient.get('/test2');

      // Let the requests hit the 401 and start refresh
      await new Promise(resolve => setTimeout(resolve, 10));

      // Complete the refresh
      refreshResolve!(true);

      // Both requests should complete successfully
      const [result1, result2] = await Promise.all([request1Promise, request2Promise]);

      expect(result1.data).toEqual({ data: 'test1' });
      expect(result2.data).toEqual({ data: 'test2' });
      expect(mockAuthState.refreshToken).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should not retry requests that are already retries', async () => {
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: vi.fn().mockResolvedValue(true),
      });

      // Always return 401
      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockAxios.history.get).toHaveLength(2); // Original + one retry only
      }
    });

    it('should handle refresh token promise rejection', async () => {
      const mockClearAuth = vi.fn();

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        clearAuth: mockClearAuth,
        refreshToken: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockClearAuth).toHaveBeenCalled();
      }
    });

    it('should not redirect if already on login page', async () => {
      const mockClearAuth = vi.fn();

      // Mock location as login page
      const mockLocation = {
        pathname: '/login',
        href: '/login',
      };
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true,
      });

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        clearAuth: mockClearAuth,
        refreshToken: vi.fn().mockResolvedValue(false),
      });

      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockClearAuth).toHaveBeenCalled();
        expect(mockLocation.href).toBe('/login'); // Should not change
      }
    });
  });

  describe('Response Interceptor - Non-401 Errors', () => {
    it('should pass through non-401 errors without refresh', async () => {
      mockAxios.onGet('/test').reply(500, { detail: 'Server error' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockAuthState.refreshToken).not.toHaveBeenCalled();
        expect((error as AxiosError).response?.status).toBe(500);
      }
    });

    it('should pass through 403 Forbidden errors', async () => {
      mockAxios.onGet('/test').reply(403, { detail: 'Forbidden' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockAuthState.refreshToken).not.toHaveBeenCalled();
        expect((error as AxiosError).response?.status).toBe(403);
      }
    });

    it('should pass through 404 Not Found errors', async () => {
      mockAxios.onGet('/test').reply(404, { detail: 'Not found' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(mockAuthState.refreshToken).not.toHaveBeenCalled();
        expect((error as AxiosError).response?.status).toBe(404);
      }
    });
  });

  describe('Request Queue Management', () => {
    it('should process queued requests after successful refresh', async () => {
      let refreshResolve: (value: boolean) => void;
      const refreshPromise = new Promise<boolean>(resolve => {
        refreshResolve = resolve;
      });

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: vi.fn().mockReturnValue(refreshPromise),
      });

      // Set up responses
      mockAxios
        .onGet('/test1')
        .replyOnce(401)
        .onGet('/test1')
        .reply(200, { data: 'test1' })
        .onGet('/test2')
        .replyOnce(401)
        .onGet('/test2')
        .reply(200, { data: 'test2' })
        .onGet('/test3')
        .replyOnce(401)
        .onGet('/test3')
        .reply(200, { data: 'test3' });

      // Start multiple requests
      const promises = [apiClient.get('/test1'), apiClient.get('/test2'), apiClient.get('/test3')];

      // Let them hit 401 and queue up
      await new Promise(resolve => setTimeout(resolve, 10));

      // Resolve the refresh
      refreshResolve!(true);

      // All should succeed
      const results = await Promise.all(promises);
      expect(results.map(r => r.data)).toEqual([
        { data: 'test1' },
        { data: 'test2' },
        { data: 'test3' },
      ]);
    });

    it('should reject queued requests if refresh fails', async () => {
      let refreshReject: (error: Error) => void;
      const refreshPromise = new Promise<boolean>((resolve, reject) => {
        refreshReject = reject;
      });

      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        clearAuth: vi.fn(),
        refreshToken: vi.fn().mockReturnValue(refreshPromise),
      });

      mockAxios.onGet('/test1').reply(401).onGet('/test2').reply(401);

      // Start multiple requests
      const promises = [
        apiClient.get('/test1').catch(e => e),
        apiClient.get('/test2').catch(e => e),
      ];

      // Let them queue up
      await new Promise(resolve => setTimeout(resolve, 10));

      // Reject the refresh
      refreshReject!(new Error('Refresh failed'));

      // All should fail
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Error);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle requests without auth store', async () => {
      // Remove auth store
      delete (window as any).__authStore;

      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const result = await apiClient.get('/test');
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should handle malformed auth store', async () => {
      (window as any).__authStore = { invalidStore: true };

      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const result = await apiClient.get('/test');
      expect(result.data).toEqual({ data: 'success' });
    });

    it('should handle network errors during refresh', async () => {
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        clearAuth: vi.fn(),
        refreshToken: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle concurrent refresh with different auth states', async () => {
      let callCount = 0;
      mockAuthStore.getState.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            ...mockAuthState,
            refreshToken: vi.fn().mockResolvedValue(true),
          };
        }
        return {
          ...mockAuthState,
          refreshToken: vi.fn().mockResolvedValue(false),
        };
      });

      mockAxios.onGet('/test').reply(401, { detail: 'Token expired' });

      try {
        await apiClient.get('/test');
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Should handle the changing auth state gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Request Configuration', () => {
    it('should preserve original request configuration', async () => {
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: vi.fn().mockResolvedValue(true),
      });

      const customHeaders = { 'X-Custom-Header': 'custom-value' };
      const customConfig = {
        headers: customHeaders,
        timeout: 5000,
        params: { test: 'param' },
      };

      // First request fails, second succeeds
      mockAxios.onGet('/test').replyOnce(401).onGet('/test').reply(200, { data: 'success' });

      await apiClient.get('/test', customConfig);

      // Both requests should have custom config
      expect(mockAxios.history.get).toHaveLength(2);
      expect(mockAxios.history.get[0].headers?.['X-Custom-Header']).toBe('custom-value');
      expect(mockAxios.history.get[1].headers?.['X-Custom-Header']).toBe('custom-value');
    });

    it('should handle POST requests with body data', async () => {
      mockAuthStore.getState.mockReturnValue({
        ...mockAuthState,
        refreshToken: vi.fn().mockResolvedValue(true),
      });

      const postData = { name: 'test', value: 123 };

      mockAxios.onPost('/test').replyOnce(401).onPost('/test').reply(200, { data: 'created' });

      await apiClient.post('/test', postData);

      expect(mockAxios.history.post).toHaveLength(2);
      expect(JSON.parse(mockAxios.history.post[0].data)).toEqual(postData);
      expect(JSON.parse(mockAxios.history.post[1].data)).toEqual(postData);
    });
  });
});
