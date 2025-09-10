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
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const auth = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>('/auth/login', credentials);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
    localStorage.removeItem('token');
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
    const response = await apiClient.get<PhotoListResponse>('/photos', { params });
    return response.data;
  },

  getFeatured: async (limit = 10): Promise<Photo[]> => {
    try {
      console.log('Fetching featured photos from:', `/photos/featured?limit=${limit}`);
      const response = await apiClient.get<Photo[]>(`/photos/featured?limit=${limit}`);
      console.log('Featured photos response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured photos:', error);
      // Return empty array as fallback
      return [];
    }
  },

  getById: async (id: string, incrementViews = true): Promise<Photo> => {
    const response = await apiClient.get<Photo>(`/photos/${id}?increment_views=${incrementViews}`);
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
      if (value !== undefined) {
        formData.append(key, value.toString());
      }
    });

    const response = await apiClient.post<Photo>('/photos', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id: string, updates: Partial<Photo>): Promise<Photo> => {
    const response = await apiClient.put<Photo>(`/photos/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/photos/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/photos/stats/summary');
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
    const response = await apiClient.get<ProjectListResponse>('/projects', { params });
    return response.data;
  },

  getFeatured: async (): Promise<Project[]> => {
    try {
      console.log('Fetching featured projects from:', '/projects/featured');
      const response = await apiClient.get<Project[]>('/projects/featured');
      console.log('Featured projects response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured projects:', error);
      // Return empty array as fallback
      return [];
    }
  },

  getByIdOrSlug: async (identifier: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${identifier}`);
    return response.data;
  },

  create: async (
    project: Omit<Project, 'id' | 'slug' | 'created_at' | 'updated_at'>
  ): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects', project);
    return response.data;
  },

  update: async (id: string, updates: Partial<Project>): Promise<Project> => {
    const response = await apiClient.put<Project>(`/projects/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/projects/stats/summary');
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
    const response = await apiClient.get<BlogPostListResponse>('/blog', { params });
    return response.data;
  },

  listAll: async (
    params: {
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<BlogPostListResponse> => {
    const response = await apiClient.get<BlogPostListResponse>('/blog/admin', { params });
    return response.data;
  },

  getByIdOrSlug: async (identifier: string, incrementViews = true): Promise<BlogPost> => {
    const response = await apiClient.get<BlogPost>(
      `/blog/${identifier}?increment_views=${incrementViews}`
    );
    return response.data;
  },

  create: async (
    post: Omit<BlogPost, 'id' | 'slug' | 'view_count' | 'read_time' | 'created_at' | 'updated_at'>
  ): Promise<BlogPost> => {
    const response = await apiClient.post<BlogPost>('/blog', post);
    return response.data;
  },

  update: async (id: string, updates: Partial<BlogPost>): Promise<BlogPost> => {
    const response = await apiClient.put<BlogPost>(`/blog/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/blog/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/blog/stats/summary');
    return response.data;
  },
};

// Sub-apps API
export const subapps = {
  list: async (menuOnly = true): Promise<SubAppListResponse> => {
    try {
      console.log('Fetching subapps from:', '/subapps', { params: { menu_only: menuOnly } });
      const response = await apiClient.get<SubAppListResponse>('/subapps', {
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
      console.log('Fetching authenticated subapps from:', '/subapps/authenticated');
      const response = await apiClient.get<SubAppListResponse>('/subapps/authenticated', {
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
    const response = await apiClient.get<SubAppListResponse>('/subapps/admin');
    return response.data;
  },

  getByIdOrSlug: async (identifier: string): Promise<SubApp> => {
    const response = await apiClient.get<SubApp>(`/subapps/${identifier}`);
    return response.data;
  },

  create: async (
    subapp: Omit<SubApp, 'id' | 'slug' | 'created_at' | 'updated_at'>
  ): Promise<SubApp> => {
    const response = await apiClient.post<SubApp>('/subapps', subapp);
    return response.data;
  },

  update: async (id: string, updates: Partial<SubApp>): Promise<SubApp> => {
    const response = await apiClient.put<SubApp>(`/subapps/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/subapps/${id}`);
  },

  getStats: async () => {
    const response = await apiClient.get('/subapps/stats/summary');
    return response.data;
  },
};

export default apiClient;
