/**
 * API Integration Tests
 *
 * Integration tests for API client and service layer including:
 * - HTTP client configuration and interceptors
 * - Authentication flow and token handling
 * - CRUD operations for all resources (projects, photos, blog, subapps)
 * - Error handling and response transformation
 * - Request/response interceptors and retry logic
 * - API endpoint integration with backend
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import apiClient, { projects, photos, blog, subapps, auth } from '../../api/client';
import { createMockProject, mockProjectsListResponse } from '../fixtures/projects';
import type {
  Project,
  ProjectListResponse,
  Photo,
  PhotoListResponse,
  BlogPost,
  BlogPostListResponse,
  SubApp,
  SubAppListResponse,
  User,
  LoginRequest,
  TokenResponse,
} from '../../types';

// Create mock adapter
let mockAdapter: MockAdapter;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

describe('API Integration Tests', () => {
  beforeEach(() => {
    mockAdapter = new MockAdapter(apiClient);
    vi.clearAllMocks();
    // Provide a default auth store for apiClient interceptors
    (window as any).__authStore = {
      getState: () => ({ accessToken: 'mock-token', clearAuth: vi.fn(), refreshToken: vi.fn() }),
    };
  });

  afterEach(() => {
    mockAdapter.restore();
    localStorageMock.clear();
  });

  describe('HTTP Client Configuration', () => {
    it('uses correct base URL', () => {
      // In tests, API base defaults to '/api' unless VITE_API_URL is set
      expect(apiClient.defaults.baseURL).toBe('/api');
    });

    it('sets default headers', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });

    it('includes authorization header when token exists', async () => {
      // apiClient reads token from window.__authStore, not localStorage
      (window as any).__authStore = {
        getState: () => ({ accessToken: 'test-token' }),
      };
      mockAdapter.onGet('/test').reply(200, {});

      await apiClient.get('/test');

      expect(mockAdapter.history.get[0].headers?.Authorization).toBe('Bearer test-token');
    });

    it('works without authorization header when no token', async () => {
      (window as any).__authStore = {
        getState: () => ({ accessToken: undefined }),
      };
      mockAdapter.onGet('/test').reply(200, {});

      await apiClient.get('/test');

      expect(mockAdapter.history.get[0].headers?.Authorization).toBeUndefined();
    });

    it('handles 401 responses by clearing token and redirecting', async () => {
      // Navigate to a non-public page to trigger redirect behavior and set location
      window.history.pushState({}, '', '/admin');
      (window as any).location.pathname = '/admin';
      mockAdapter.onGet('/protected').reply(401, { message: 'Unauthorized' });

      try {
        await apiClient.get('/protected');
      } catch (error) {
        // Expected to throw
      }

      // apiClient clears auth via authStore and redirects if not on public page
      expect(window.location.pathname).toBe('/login');
    });

    it('passes through other error responses', async () => {
      mockAdapter.onGet('/error').reply(500, { message: 'Server Error' });

      await expect(apiClient.get('/error')).rejects.toMatchObject({
        response: {
          status: 500,
          data: { message: 'Server Error' },
        },
      });
    });
  });

  describe('Authentication API', () => {
    const mockLoginRequest: LoginRequest = {
      username: 'admin',
      password: 'admin',
    };

    const mockTokenResponse: TokenResponse = {
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
    };

    const mockUser: User = {
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      is_active: true,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    };

    it('logs in user successfully', async () => {
      mockAdapter.onPost('/auth/login').reply(200, mockTokenResponse);

      const result = await auth.login(mockLoginRequest);

      expect(result).toEqual(mockTokenResponse);
      expect(mockAdapter.history.post[0].data).toBe(JSON.stringify(mockLoginRequest));
    });

    it('gets current user info', async () => {
      mockAdapter.onGet('/auth/me').reply(200, mockUser);

      const result = await auth.getMe();

      expect(result).toEqual(mockUser);
    });

    it('logs out user successfully', async () => {
      mockAdapter.onPost('/auth/logout').reply(200, {});

      await expect(auth.logout()).resolves.toBeUndefined();
      expect(mockAdapter.history.post.some(req => req.url === '/auth/logout')).toBe(true);
    });

    it('handles login errors', async () => {
      mockAdapter.onPost('/auth/login').reply(401, { detail: 'Invalid credentials' });

      await expect(auth.login(mockLoginRequest)).rejects.toBeTruthy();
    });
  });

  describe('Projects API', () => {
    const mockProject = createMockProject();

    it('fetches projects list successfully', async () => {
      mockAdapter.onGet('/projects').reply(200, mockProjectsListResponse);

      const result = await projects.list();

      expect(result).toEqual(mockProjectsListResponse);
    });

    it('fetches projects with filters', async () => {
      mockAdapter.onGet('/projects').reply(200, mockProjectsListResponse);

      await projects.list({ featured_only: true, status: 'active' });

      expect(mockAdapter.history.get[0].params).toEqual({
        featured_only: true,
        status: 'active',
      });
    });

    it('fetches featured projects', async () => {
      const featuredProjects = [createMockProject({ featured: true })];
      mockAdapter.onGet('/projects/featured').reply(200, featuredProjects);

      const result = await projects.getFeatured();

      expect(result).toEqual(featuredProjects);
    });

    it('handles featured projects API errors gracefully', async () => {
      mockAdapter.onGet('/projects/featured').reply(500, { message: 'Server error' });

      const result = await projects.getFeatured();

      expect(result).toEqual([]); // Should return empty array on error
    });

    it('fetches single project by ID or slug', async () => {
      mockAdapter.onGet('/projects/test-project').reply(200, mockProject);

      const result = await projects.getByIdOrSlug('test-project');

      expect(result).toEqual(mockProject);
    });

    it('creates new project', async () => {
      const newProject = { ...mockProject };
      delete (newProject as any).id;
      delete (newProject as any).slug;
      delete (newProject as any).created_at;
      delete (newProject as any).updated_at;

      mockAdapter.onPost('/projects').reply(201, mockProject);

      const result = await projects.create(newProject);

      expect(result).toEqual(mockProject);
      expect(JSON.parse(mockAdapter.history.post[0].data)).toMatchObject(newProject);
    });

    it('updates existing project', async () => {
      const updates = { title: 'Updated Title', description: 'Updated description' };
      const updatedProject = { ...mockProject, ...updates };

      mockAdapter.onPut('/projects/project-1').reply(200, updatedProject);

      const result = await projects.update('project-1', updates);

      expect(result).toEqual(updatedProject);
      expect(JSON.parse(mockAdapter.history.put[0].data)).toEqual(updates);
    });

    it('deletes project', async () => {
      mockAdapter.onDelete('/projects/project-1').reply(204);

      await projects.delete('project-1');

      expect(mockAdapter.history.delete).toHaveLength(1);
      expect(mockAdapter.history.delete[0].url).toBe('/projects/project-1');
    });

    it('fetches project statistics', async () => {
      const stats = { total: 10, active: 7, featured: 3 };
      mockAdapter.onGet('/projects/stats/summary').reply(200, stats);

      const result = await projects.getStats();

      expect(result).toEqual(stats);
    });

    it('handles project API errors appropriately', async () => {
      mockAdapter.onGet('/projects/nonexistent').reply(404, { detail: 'Project not found' });

      await expect(projects.getByIdOrSlug('nonexistent')).rejects.toMatchObject({
        response: {
          status: 404,
          data: { detail: 'Project not found' },
        },
      });
    });
  });

  describe('Photos API', () => {
    const mockPhoto: Photo = {
      id: 'photo-1',
      filename: 'test-photo.jpg',
      original_filename: 'original-test.jpg',
      title: 'Test Photo',
      description: 'A test photo',
      category: 'test',
      tags: 'nature, landscape',
      comments: 'Beautiful shot',
      featured: true,
      file_size: 1024000,
      image_url: '/photos/test-photo.jpg',
      thumbnail_url: '/thumbnails/test-photo.jpg',
      camera_make: 'Canon',
      camera_model: 'EOS R5',
      focal_length: '85mm',
      aperture: 'f/2.8',
      shutter_speed: '1/200',
      iso: '400',
      taken_at: '2023-01-15T12:00:00Z',
      location: 'Test Location',
      latitude: 40.7128,
      longitude: -74.006,
      view_count: 42,
      created_at: '2023-01-15T10:00:00Z',
      updated_at: '2023-01-15T10:00:00Z',
    };

    it('fetches photos list with pagination', async () => {
      const photoListResponse: PhotoListResponse = {
        photos: [mockPhoto],
        total: 1,
        page: 1,
        per_page: 10,
        pages: 1,
      };

      mockAdapter.onGet('/photos').reply(200, photoListResponse);

      const result = await photos.list({ page: 1, per_page: 10 });

      expect(result).toEqual(photoListResponse);
    });

    it('fetches featured photos', async () => {
      mockAdapter.onGet('/photos/featured?limit=5').reply(200, [mockPhoto]);

      const result = await photos.getFeatured(5);

      expect(result).toEqual([mockPhoto]);
    });

    it('handles featured photos errors gracefully', async () => {
      mockAdapter.onGet('/photos/featured?limit=10').reply(500, { message: 'Server error' });

      const result = await photos.getFeatured();

      expect(result).toEqual([]); // Should return empty array on error
    });

    it('fetches single photo by ID', async () => {
      mockAdapter.onGet('/photos/photo-1?increment_views=true').reply(200, mockPhoto);

      const result = await photos.getById('photo-1');

      expect(result).toEqual(mockPhoto);
    });

    it('uploads photo with metadata', async () => {
      const file = new File(['photo content'], 'test.jpg', { type: 'image/jpeg' });
      const metadata = {
        title: 'New Photo',
        description: 'Uploaded photo',
        category: 'test',
        featured: true,
      };

      mockAdapter.onPost('/photos').reply(201, mockPhoto);

      const result = await photos.upload(file, metadata);

      expect(result).toEqual(mockPhoto);

      // Check that FormData was sent
      const request = mockAdapter.history.post[0];
      expect(request.headers?.['Content-Type']).toMatch(/multipart\/form-data/);
    });

    it('updates photo metadata', async () => {
      const updates = { title: 'Updated Photo', featured: false };
      const updatedPhoto = { ...mockPhoto, ...updates };

      mockAdapter.onPut('/photos/photo-1').reply(200, updatedPhoto);

      const result = await photos.update('photo-1', updates);

      expect(result).toEqual(updatedPhoto);
    });

    it('deletes photo', async () => {
      mockAdapter.onDelete('/photos/photo-1').reply(204);

      await photos.delete('photo-1');

      expect(mockAdapter.history.delete).toHaveLength(1);
    });

    it('fetches photo statistics', async () => {
      const stats = { total: 150, featured: 25, categories: 8 };
      mockAdapter.onGet('/photos/stats/summary').reply(200, stats);

      const result = await photos.getStats();

      expect(result).toEqual(stats);
    });
  });

  describe('Blog API', () => {
    const mockBlogPost: BlogPost = {
      id: 'post-1',
      title: 'Test Blog Post',
      slug: 'test-blog-post',
      content: '# Test Post\n\nThis is a test blog post.',
      excerpt: 'This is a test blog post.',
      published: true,
      featured: false,
      tags: 'test, blog',
      view_count: 42,
      read_time: 5,
      created_at: '2023-01-15T10:00:00Z',
      updated_at: '2023-01-15T10:00:00Z',
    };

    it('fetches published blog posts', async () => {
      const blogListResponse: BlogPostListResponse = {
        posts: [mockBlogPost],
        total: 1,
        page: 1,
        per_page: 10,
        pages: 1,
      };

      mockAdapter.onGet('/blog').reply(200, blogListResponse);

      const result = await blog.list({ published_only: true });

      expect(result).toEqual(blogListResponse);
    });

    it('fetches all blog posts for admin', async () => {
      const allPosts = [mockBlogPost, { ...mockBlogPost, id: 'draft-1', published: false }];
      const blogListResponse: BlogPostListResponse = {
        posts: allPosts,
        total: 2,
        page: 1,
        per_page: 10,
        pages: 1,
      };

      mockAdapter.onGet('/blog/admin').reply(200, blogListResponse);

      const result = await blog.listAll();

      expect(result).toEqual(blogListResponse);
    });

    it('fetches single blog post by ID or slug', async () => {
      mockAdapter.onGet('/blog/test-post?increment_views=true').reply(200, mockBlogPost);

      const result = await blog.getByIdOrSlug('test-post');

      expect(result).toEqual(mockBlogPost);
    });

    it('creates new blog post', async () => {
      const newPost = { ...mockBlogPost };
      delete (newPost as any).id;
      delete (newPost as any).slug;
      delete (newPost as any).view_count;
      delete (newPost as any).read_time;
      delete (newPost as any).created_at;
      delete (newPost as any).updated_at;

      mockAdapter.onPost('/blog').reply(201, mockBlogPost);

      const result = await blog.create(newPost);

      expect(result).toEqual(mockBlogPost);
    });

    it('updates blog post', async () => {
      const updates = { title: 'Updated Post', published: false };
      const updatedPost = { ...mockBlogPost, ...updates };

      mockAdapter.onPut('/blog/post-1').reply(200, updatedPost);

      const result = await blog.update('post-1', updates);

      expect(result).toEqual(updatedPost);
    });

    it('deletes blog post', async () => {
      mockAdapter.onDelete('/blog/post-1').reply(204);

      await blog.delete('post-1');

      expect(mockAdapter.history.delete).toHaveLength(1);
    });

    it('fetches blog statistics', async () => {
      const stats = { total: 25, published: 20, drafts: 5 };
      mockAdapter.onGet('/blog/stats/summary').reply(200, stats);

      const result = await blog.getStats();

      expect(result).toEqual(stats);
    });
  });

  describe('Sub-apps API', () => {
    const mockSubApp: SubApp = {
      id: 'subapp-1',
      name: 'Test SubApp',
      slug: 'test-subapp',
      description: 'A test sub-application',
      url: 'https://subapp.example.com',
      icon: 'test-icon',
      enabled: true,
      show_in_menu: true,
      require_auth: false,
      order_index: 1,
      created_at: '2023-01-15T10:00:00Z',
      updated_at: '2023-01-15T10:00:00Z',
    };

    it('fetches public sub-apps for menu', async () => {
      const subappListResponse: SubAppListResponse = {
        subapps: [mockSubApp],
        total: 1,
      };

      mockAdapter.onGet('/subapps').reply(200, subappListResponse);

      const result = await subapps.list(true);

      expect(result).toEqual(subappListResponse);
      expect(mockAdapter.history.get[0].params).toEqual({ menu_only: true });
    });

    it('handles sub-apps API errors gracefully', async () => {
      mockAdapter.onGet('/subapps').reply(500, { message: 'Server error' });

      const result = await subapps.list();

      expect(result).toEqual({ subapps: [], total: 0 }); // Should return empty response on error
    });

    it('fetches authenticated sub-apps', async () => {
      const authSubappResponse: SubAppListResponse = {
        subapps: [{ ...mockSubApp, require_auth: true }],
        total: 1,
      };

      mockAdapter.onGet('/subapps/authenticated').reply(200, authSubappResponse);

      const result = await subapps.listAuthenticated();

      expect(result).toEqual(authSubappResponse);
    });

    it('fetches all sub-apps for admin', async () => {
      const allSubappsResponse: SubAppListResponse = {
        subapps: [mockSubApp],
        total: 1,
      };

      mockAdapter.onGet('/subapps/admin').reply(200, allSubappsResponse);

      const result = await subapps.listAll();

      expect(result).toEqual(allSubappsResponse);
    });

    it('fetches single sub-app by ID or slug', async () => {
      mockAdapter.onGet('/subapps/test-subapp').reply(200, mockSubApp);

      const result = await subapps.getByIdOrSlug('test-subapp');

      expect(result).toEqual(mockSubApp);
    });

    it('creates new sub-app', async () => {
      const newSubApp = { ...mockSubApp };
      delete (newSubApp as any).id;
      delete (newSubApp as any).slug;
      delete (newSubApp as any).created_at;
      delete (newSubApp as any).updated_at;

      mockAdapter.onPost('/subapps').reply(201, mockSubApp);

      const result = await subapps.create(newSubApp);

      expect(result).toEqual(mockSubApp);
    });

    it('updates sub-app', async () => {
      const updates = { name: 'Updated SubApp', enabled: false };
      const updatedSubApp = { ...mockSubApp, ...updates };

      mockAdapter.onPut('/subapps/subapp-1').reply(200, updatedSubApp);

      const result = await subapps.update('subapp-1', updates);

      expect(result).toEqual(updatedSubApp);
    });

    it('deletes sub-app', async () => {
      mockAdapter.onDelete('/subapps/subapp-1').reply(204);

      await subapps.delete('subapp-1');

      expect(mockAdapter.history.delete).toHaveLength(1);
    });

    it('fetches sub-app statistics', async () => {
      const stats = { total: 5, enabled: 4, public: 3 };
      mockAdapter.onGet('/subapps/stats/summary').reply(200, stats);

      const result = await subapps.getStats();

      expect(result).toEqual(stats);
    });
  });

  describe('Network and Error Handling', () => {
    it('handles network timeouts', async () => {
      mockAdapter.onGet('/timeout').timeout();

      await expect(apiClient.get('/timeout')).rejects.toMatchObject({
        code: 'ECONNABORTED',
      });
    });

    it('handles network errors', async () => {
      mockAdapter.onGet('/network-error').networkError();

      await expect(apiClient.get('/network-error')).rejects.toMatchObject({
        message: 'Network Error',
      });
    });

    it('handles malformed JSON responses', async () => {
      mockAdapter.onGet('/bad-json').reply(200, 'not-json', {
        'content-type': 'application/json',
      });

      const response = await apiClient.get('/bad-json');
      expect(response.data).toBe('not-json');
    });

    it('handles empty responses correctly', async () => {
      mockAdapter.onDelete('/empty').reply(204, '');

      const response = await apiClient.delete('/empty');

      expect(response.status).toBe(204);
      expect(response.data).toBe('');
    });

    it('preserves response headers', async () => {
      const customHeaders = { 'x-custom-header': 'test-value' };
      mockAdapter.onGet('/headers').reply(200, { data: 'test' }, customHeaders);

      const response = await apiClient.get('/headers');

      expect(response.headers['x-custom-header']).toBe('test-value');
    });
  });

  describe('Request/Response Transformation', () => {
    it('automatically stringifies request data', async () => {
      const requestData = { name: 'test', value: 123 };
      mockAdapter.onPost('/json').reply(200, {});

      await apiClient.post('/json', requestData);

      expect(mockAdapter.history.post[0].data).toBe(JSON.stringify(requestData));
    });

    it('handles FormData requests correctly', async () => {
      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.txt'));
      formData.append('title', 'Test File');

      mockAdapter.onPost('/upload').reply(200, {});

      await apiClient.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const request = mockAdapter.history.post[0];
      expect(request.headers?.['Content-Type']).toMatch(/multipart\/form-data/);
    });

    it('handles query parameters correctly', async () => {
      mockAdapter.onGet('/search').reply(200, {});

      await apiClient.get('/search', {
        params: { q: 'test query', page: 1, limit: 10 },
      });

      expect(mockAdapter.history.get[0].params).toEqual({
        q: 'test query',
        page: 1,
        limit: 10,
      });
    });

    it('handles URL encoding in paths', async () => {
      const encodedPath = encodeURIComponent('test project with spaces');
      mockAdapter.onGet(`/projects/${encodedPath}`).reply(200, {});

      await apiClient.get(`/projects/${encodedPath}`);

      expect(mockAdapter.history.get[0].url).toBe(`/projects/${encodedPath}`);
    });
  });

  describe('Concurrent Requests', () => {
    it('handles multiple concurrent requests', async () => {
      mockAdapter.onGet('/endpoint1').reply(200, { id: 1 });
      mockAdapter.onGet('/endpoint2').reply(200, { id: 2 });
      mockAdapter.onGet('/endpoint3').reply(200, { id: 3 });

      const promises = [
        apiClient.get('/endpoint1'),
        apiClient.get('/endpoint2'),
        apiClient.get('/endpoint3'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results[0].data).toEqual({ id: 1 });
      expect(results[1].data).toEqual({ id: 2 });
      expect(results[2].data).toEqual({ id: 3 });
    });

    it('handles mixed success and failure in concurrent requests', async () => {
      mockAdapter.onGet('/success').reply(200, { status: 'ok' });
      mockAdapter.onGet('/failure').reply(500, { message: 'error' });

      const results = await Promise.allSettled([
        apiClient.get('/success'),
        apiClient.get('/failure'),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
