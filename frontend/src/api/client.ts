import axios from 'axios';
import type {
  Photo,
  PhotoListResponse,
  Project,
  ProjectListResponse,
  BlogPost,
  BlogPostListResponse,
  SubApp,
  SubAppListResponse,
  User,
  LoginRequest,
  TokenResponse,
  Content,
  ContentCreate,
  ContentUpdate,
  ContentListResponse,
  ContentKeyValue,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Flag to track if we're already refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error?: any, token?: string) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });

  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // This ensures cookies are sent with requests
});

// Request interceptor to add auth token from store
apiClient.interceptors.request.use(config => {
  // Get token from store dynamically
  const authStore = (window as any).__authStore?.getState?.();
  const token = authStore?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic token refresh
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh using the auth store
        const authStore = (window as any).__authStore?.getState?.();
        if (authStore?.refreshToken) {
          const success = await authStore.refreshToken();
          if (success) {
            processQueue();
            isRefreshing = false;
            return apiClient(originalRequest);
          }
        }

        // If refresh fails, process queue with error and redirect
        throw new Error('Token refresh failed');
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;

        // Clear auth state and redirect to login
        const authStore = (window as any).__authStore?.getState?.();
        if (authStore?.clearAuth) {
          authStore.clearAuth();
        }

        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  login: async (credentials: LoginRequest & { remember_me?: boolean }): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/api/auth/login', credentials);
    return response.data;
  },

  refresh: async (): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/api/auth/refresh');
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/api/auth/logout');
  },

  revokeAllSessions: async (): Promise<void> => {
    await apiClient.post('/api/auth/revoke-all-sessions');
  },
};

// Photos API
export const photos = {
  list: async (
    params: {
      page?: number;
      per_page?: number;
      category?: string;
      featured?: boolean;
      order_by?: string;
    } = {}
  ): Promise<PhotoListResponse> => {
    const response = await apiClient.get<PhotoListResponse>('/api/photos', { params });
    return response.data;
  },

  getFeatured: async (limit = 10): Promise<Photo[]> => {
    try {
      console.log('Fetching featured photos from:', `/api/photos/featured?limit=${limit}`);
      const response = await apiClient.get<Photo[]>(`/api/photos/featured?limit=${limit}`);
      console.log('Featured photos response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured photos:', error);
      // Return empty array as fallback
      return [];
    }
  },

  getById: async (id: string, incrementViews = true): Promise<Photo> => {
    const response = await apiClient.get<Photo>(
      `/api/photos/${id}?increment_views=${incrementViews}`
    );
    return response.data;
  },

  upload: async (
    file: File,
    metadata: {
      title?: string;
      description?: string;
      category?: string;
      tags?: string;
      comments?: string;
      featured?: boolean;
    }
  ): Promise<Photo> => {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Handle boolean values properly
        if (typeof value === 'boolean') {
          formData.append(key, value.toString());
        }
        // Handle string values, ensuring they're not empty strings unless intentional
        else if (typeof value === 'string') {
          formData.append(key, value);
        }
        // Handle other types
        else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await apiClient.post<Photo>('/api/photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, updates: Partial<Photo>): Promise<Photo> => {
    const response = await apiClient.put<Photo>(`/api/photos/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/photos/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/api/photos/stats/summary');
    return response.data;
  },
};

// Projects API
export const projects = {
  list: async (
    params: {
      featured_only?: boolean;
      status?: string;
    } = {}
  ): Promise<ProjectListResponse> => {
    const response = await apiClient.get<ProjectListResponse>('/api/projects', { params });
    return response.data;
  },

  getFeatured: async (): Promise<Project[]> => {
    try {
      console.log('Fetching featured projects from:', '/api/projects/featured');
      const response = await apiClient.get<Project[]>('/api/projects/featured');
      console.log('Featured projects response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured projects:', error);
      // Return empty array as fallback
      return [];
    }
  },

  getByIdOrSlug: async (identifier: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/api/projects/${identifier}`);
    return response.data;
  },

  create: async (
    project: Omit<Project, 'id' | 'slug' | 'created_at' | 'updated_at'>
  ): Promise<Project> => {
    const response = await apiClient.post<Project>('/api/projects', project);
    return response.data;
  },

  update: async (id: string, updates: Partial<Project>): Promise<Project> => {
    const response = await apiClient.put<Project>(`/api/projects/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/projects/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/api/projects/stats/summary');
    return response.data;
  },
};

// Blog API
export const blog = {
  list: async (
    params: {
      page?: number;
      per_page?: number;
      published_only?: boolean;
    } = {}
  ): Promise<BlogPostListResponse> => {
    const response = await apiClient.get<BlogPostListResponse>('/api/blog', { params });
    return response.data;
  },

  listAll: async (
    params: {
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<BlogPostListResponse> => {
    const response = await apiClient.get<BlogPostListResponse>('/api/blog/admin', { params });
    return response.data;
  },

  getByIdOrSlug: async (identifier: string, incrementViews = true): Promise<BlogPost> => {
    const response = await apiClient.get<BlogPost>(
      `/api/blog/${identifier}?increment_views=${incrementViews}`
    );
    return response.data;
  },

  create: async (
    post: Omit<BlogPost, 'id' | 'slug' | 'view_count' | 'read_time' | 'created_at' | 'updated_at'>
  ): Promise<BlogPost> => {
    const response = await apiClient.post<BlogPost>('/api/blog', post);
    return response.data;
  },

  update: async (id: string, updates: Partial<BlogPost>): Promise<BlogPost> => {
    const response = await apiClient.put<BlogPost>(`/api/blog/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/blog/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/api/blog/stats/summary');
    return response.data;
  },
};

// Sub-apps API
export const subapps = {
  list: async (menuOnly = true): Promise<SubAppListResponse> => {
    try {
      console.log('Fetching subapps from:', '/api/subapps', { params: { menu_only: menuOnly } });
      const response = await apiClient.get<SubAppListResponse>('/api/subapps', {
        params: { menu_only: menuOnly },
      });
      console.log('Subapps response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching subapps:', error);
      // Return empty response as fallback
      return { subapps: [], total: 0 };
    }
  },

  listAuthenticated: async (menuOnly = true): Promise<SubAppListResponse> => {
    try {
      console.log('Fetching authenticated subapps from:', '/api/subapps/authenticated');
      const response = await apiClient.get<SubAppListResponse>('/api/subapps/authenticated', {
        params: { menu_only: menuOnly },
      });
      console.log('Authenticated subapps response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching authenticated subapps:', error);
      // Return empty response as fallback
      return { subapps: [], total: 0 };
    }
  },

  listAll: async (): Promise<SubAppListResponse> => {
    const response = await apiClient.get<SubAppListResponse>('/api/subapps/admin');
    return response.data;
  },

  getByIdOrSlug: async (identifier: string): Promise<SubApp> => {
    const response = await apiClient.get<SubApp>(`/api/subapps/${identifier}`);
    return response.data;
  },

  create: async (
    subapp: Omit<SubApp, 'id' | 'slug' | 'created_at' | 'updated_at'>
  ): Promise<SubApp> => {
    const response = await apiClient.post<SubApp>('/api/subapps', subapp);
    return response.data;
  },

  update: async (id: string, updates: Partial<SubApp>): Promise<SubApp> => {
    const response = await apiClient.put<SubApp>(`/api/subapps/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/subapps/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/api/subapps/stats/summary');
    return response.data;
  },
};

// Content API
export const content = {
  // Public endpoints (no auth required)
  getByKey: async (key: string): Promise<ContentKeyValue> => {
    const response = await apiClient.get<ContentKeyValue>(`/api/content/key/${key}`);
    return response.data;
  },

  getByKeys: async (keys: string[]): Promise<Record<string, ContentKeyValue>> => {
    const response = await apiClient.get<Record<string, ContentKeyValue>>('/api/content/public', {
      params: { keys: keys.join(',') },
    });
    return response.data;
  },

  getByCategory: async (category: string): Promise<Record<string, ContentKeyValue>> => {
    const response = await apiClient.get<Record<string, ContentKeyValue>>('/api/content/public', {
      params: { category },
    });
    return response.data;
  },

  // Admin endpoints (auth required)
  list: async (
    params: {
      category?: string;
      is_active?: boolean;
      search?: string;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<ContentListResponse> => {
    const response = await apiClient.get<ContentListResponse>('/api/content', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Content> => {
    const response = await apiClient.get<Content>(`/api/content/${id}`);
    return response.data;
  },

  create: async (contentData: ContentCreate): Promise<Content> => {
    const response = await apiClient.post<Content>('/api/content', contentData);
    return response.data;
  },

  update: async (id: string, updates: ContentUpdate): Promise<Content> => {
    const response = await apiClient.put<Content>(`/api/content/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/content/${id}`);
  },
};

export default apiClient;
export { apiClient };
export const api = apiClient;
