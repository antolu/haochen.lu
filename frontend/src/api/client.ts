import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import type {
  Photo,
  PhotoListResponse,
  Project,
  ProjectListResponse,
  BlogPost,
  BlogPostListResponse,
  SubApp,
  SubAppListResponse,
  PhotoStatsSummary,
  ProjectStatsSummary,
  SubAppStatsSummary,
  User,
  LoginRequest,
  TokenResponse,
  Content,
  ContentCreate,
  ContentUpdate,
  ContentListResponse,
  ContentKeyValue,
  ProfilePicture,
  ProfilePictureListResponse,
  ActiveProfilePictureResponse,
  ProfilePictureUploadData,
  HeroImage,
  HeroImageCreate,
  HeroImageUpdate,
  HeroImageFocalPointUpdate,
} from "../types";

const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

// Flag to track if we're already refreshing to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error?: unknown, token?: string) => {
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
    "Content-Type": "application/json",
  },
  withCredentials: true, // This ensures cookies are sent with requests
});

// Request interceptor to add auth token from store
apiClient.interceptors.request.use((config) => {
  // Get token from store dynamically
  const authStore = (
    window as unknown as {
      __authStore?: {
        getState?: () => {
          isAuthenticated?: boolean;
          token?: string;
          accessToken?: string;
          refreshToken?: string;
          clearAuth?: () => void;
        };
      };
    }
  ).__authStore?.getState?.();
  const token = authStore?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for automatic token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return apiClient(originalRequest);
          })
          .catch((err: Error) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh using the auth store
        const authStoreInstance = (
          window as unknown as {
            __authStore?: {
              getState?: () => {
                isAuthenticated?: boolean;
                token?: string;
                accessToken?: string;
              };
              refreshToken?: () => Promise<boolean>;
            };
          }
        ).__authStore;
        if (authStoreInstance?.refreshToken) {
          const success = await authStoreInstance.refreshToken();
          if (success) {
            processQueue();
            isRefreshing = false;
            return apiClient(originalRequest);
          }
        }

        // If refresh fails, process queue with error and redirect
        throw new Error("Token refresh failed");
      } catch (refreshError) {
        processQueue(refreshError);
        isRefreshing = false;

        // Clear auth state and redirect to login
        const authStoreInstance = (
          window as unknown as { __authStore?: { clearAuth?: () => void } }
        ).__authStore;
        if (authStoreInstance?.clearAuth) {
          authStoreInstance.clearAuth();
        }

        // Only redirect if not already on login page and if this was an authenticated request
        // Don't redirect for public pages or failed auth refresh attempts
        const isPublicPage = ["/", "/photography", "/projects", "/blog"].some(
          (path) =>
            window.location.pathname === path ||
            window.location.pathname.startsWith(path),
        );
        const isAuthRefresh =
          originalRequest?.url?.includes("/auth/refresh") ?? false;

        if (
          window.location.pathname !== "/login" &&
          !isPublicPage &&
          !isAuthRefresh
        ) {
          window.location.href = "/login";
        }

        return Promise.reject(new Error("Refresh failed"));
      }
    }

    return Promise.reject(error);
  },
);

// Auth API
export const auth = {
  login: async (
    credentials: LoginRequest & { remember_me?: boolean },
  ): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>(
      "/auth/login",
      credentials,
    );
    return response.data;
  },

  refresh: async (): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/refresh");
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },

  revokeAllSessions: async (): Promise<void> => {
    await apiClient.post("/auth/revoke-all-sessions");
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
    } = {},
  ): Promise<PhotoListResponse> => {
    const response = await apiClient.get<PhotoListResponse>("/photos", {
      params,
    });
    return response.data;
  },

  getFeatured: async (limit = 10): Promise<Photo[]> => {
    try {
      const response = await apiClient.get<Photo[]>(
        `/photos/featured?limit=${limit}`,
      );
      return response.data;
    } catch {
      // Return empty array as fallback
      return [];
    }
  },

  getTags: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>("/photos/tags");
    return response.data;
  },

  getById: async (id: string, incrementViews = true): Promise<Photo> => {
    const response = await apiClient.get<Photo>(
      `/photos/${id}?increment_views=${incrementViews}`,
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
    },
    options?: { uploadId?: string },
  ): Promise<Photo> => {
    const formData = new FormData();
    formData.append("file", file);

    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        // Handle boolean values properly
        if (typeof value === "boolean") {
          formData.append(key, value.toString());
        }
        // Handle string values, ensuring they're not empty strings unless intentional
        else if (typeof value === "string") {
          formData.append(key, value);
        }
        // Handle other types
        else {
          formData.append(key, String(value));
        }
      }
    });

    const response = await apiClient.post<Photo>("/photos", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(options?.uploadId ? { "X-Upload-Id": options.uploadId } : {}),
        // Encourage AVIF/WebP preference where applicable
        Accept: "image/avif,image/webp,image/jpeg;q=0.9,*/*;q=0.8",
      },
    });
    return response.data;
  },

  update: async (id: string, updates: Partial<Photo>): Promise<Photo> => {
    const response = await apiClient.put<Photo>(`/photos/${id}`, updates);
    return response.data;
  },

  reorder: async (
    items: { id: string; order: number }[],
    normalize = true,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/photos/reorder`,
      {
        items,
        normalize,
      },
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/photos/${id}`);
  },

  getStats: async (): Promise<PhotoStatsSummary> => {
    const response = await apiClient.get<PhotoStatsSummary>(
      "/photos/stats/summary",
    );
    return response.data;
  },
};

// Projects API
export const projects = {
  list: async (
    params: {
      featured_only?: boolean;
      status?: string;
    } = {},
  ): Promise<ProjectListResponse> => {
    const response = await apiClient.get<ProjectListResponse>("/projects", {
      params,
    });
    return response.data;
  },

  getFeatured: async (): Promise<Project[]> => {
    try {
      const response = await apiClient.get<Project[]>("/projects/featured");
      return response.data;
    } catch {
      // Return empty array as fallback
      return [];
    }
  },

  getByIdOrSlug: async (identifier: string): Promise<Project> => {
    const response = await apiClient.get<Project>(`/projects/${identifier}`);
    return response.data;
  },

  create: async (
    project: Omit<Project, "id" | "slug" | "created_at" | "updated_at">,
  ): Promise<Project> => {
    const response = await apiClient.post<Project>("/projects", project);
    return response.data;
  },

  update: async (id: string, updates: Partial<Project>): Promise<Project> => {
    const response = await apiClient.put<Project>(`/projects/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`);
  },

  getStats: async (): Promise<ProjectStatsSummary> => {
    const response = await apiClient.get<ProjectStatsSummary>(
      "/projects/stats/summary",
    );
    return response.data;
  },

  getTechnologies: async (): Promise<string[]> => {
    const response = await apiClient.get<string[]>("/projects/technologies");
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
    } = {},
  ): Promise<BlogPostListResponse> => {
    const response = await apiClient.get<BlogPostListResponse>("/blog", {
      params,
    });
    return response.data;
  },

  listAll: async (
    params: {
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<BlogPostListResponse> => {
    const response = await apiClient.get<BlogPostListResponse>("/blog/admin", {
      params,
    });
    return response.data;
  },

  getByIdOrSlug: async (
    identifier: string,
    incrementViews = true,
  ): Promise<BlogPost> => {
    const response = await apiClient.get<BlogPost>(
      `/blog/${identifier}?increment_views=${incrementViews}`,
    );
    return response.data;
  },

  create: async (
    post: Omit<
      BlogPost,
      "id" | "slug" | "view_count" | "read_time" | "created_at" | "updated_at"
    >,
  ): Promise<BlogPost> => {
    const response = await apiClient.post<BlogPost>("/blog", post);
    return response.data;
  },

  update: async (id: string, updates: Partial<BlogPost>): Promise<BlogPost> => {
    const response = await apiClient.put<BlogPost>(`/blog/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/blog/${id}`);
  },

  getStats: async (): Promise<{ total_posts: number }> => {
    const response = await apiClient.get<{ total_posts: number }>(
      "/blog/stats/summary",
    );
    return response.data;
  },
};

// Sub-apps API
export const subapps = {
  list: async (menuOnly = true): Promise<SubAppListResponse> => {
    try {
      const response = await apiClient.get<SubAppListResponse>("/subapps", {
        params: { menu_only: menuOnly },
      });
      return response.data;
    } catch {
      // Return empty response as fallback
      return { subapps: [], total: 0 };
    }
  },

  listAuthenticated: async (menuOnly = true): Promise<SubAppListResponse> => {
    try {
      const response = await apiClient.get<SubAppListResponse>(
        "/subapps/authenticated",
        {
          params: { menu_only: menuOnly },
        },
      );
      return response.data;
    } catch {
      // Return empty response as fallback
      return { subapps: [], total: 0 };
    }
  },

  listAll: async (): Promise<SubAppListResponse> => {
    const response = await apiClient.get<SubAppListResponse>("/subapps/admin");
    return response.data;
  },

  getByIdOrSlug: async (identifier: string): Promise<SubApp> => {
    const response = await apiClient.get<SubApp>(`/subapps/${identifier}`);
    return response.data;
  },

  create: async (
    subapp: Omit<SubApp, "id" | "slug" | "created_at" | "updated_at">,
  ): Promise<SubApp> => {
    const response = await apiClient.post<SubApp>("/subapps", subapp);
    return response.data;
  },

  update: async (id: string, updates: Partial<SubApp>): Promise<SubApp> => {
    const response = await apiClient.put<SubApp>(`/subapps/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/subapps/${id}`);
  },

  getStats: async (): Promise<SubAppStatsSummary> => {
    const response = await apiClient.get<SubAppStatsSummary>(
      "/subapps/stats/summary",
    );
    return response.data;
  },
};

// Content API
export const content = {
  // Public endpoints (no auth required)
  getByKey: async (key: string): Promise<ContentKeyValue> => {
    const response = await apiClient.get<ContentKeyValue>(
      `/content/key/${key}`,
    );
    return response.data;
  },

  getByKeys: async (
    keys: string[],
  ): Promise<Record<string, ContentKeyValue>> => {
    const response = await apiClient.get<Record<string, ContentKeyValue>>(
      "/content/public",
      {
        params: { keys: keys.join(",") },
      },
    );
    return response.data;
  },

  getByCategory: async (
    category: string,
  ): Promise<Record<string, ContentKeyValue>> => {
    const response = await apiClient.get<Record<string, ContentKeyValue>>(
      "/content/public",
      {
        params: { category },
      },
    );
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
    } = {},
  ): Promise<ContentListResponse> => {
    const response = await apiClient.get<ContentListResponse>("/content", {
      params,
    });
    return response.data;
  },

  getById: async (id: string): Promise<Content> => {
    const response = await apiClient.get<Content>(`/content/${id}`);
    return response.data;
  },

  create: async (contentData: ContentCreate): Promise<Content> => {
    const response = await apiClient.post<Content>("/content", contentData);
    return response.data;
  },

  update: async (id: string, updates: ContentUpdate): Promise<Content> => {
    const response = await apiClient.put<Content>(`/content/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/content/${id}`);
  },
};

// Settings API (admin)
export const settings = {
  getImage: async (): Promise<{
    responsive_sizes: Record<string, number>;
    quality_settings: Record<string, number>;
    avif_quality_base_offset: number;
    avif_quality_floor: number;
    avif_effort_default: number;
    webp_quality: number;
  }> => {
    const res = await apiClient.get("/settings/image");
    return res.data as any;
  },
  updateImage: async (
    payload: Partial<{
      responsive_sizes: Record<string, number>;
      quality_settings: Record<string, number>;
      avif_quality_base_offset: number;
      avif_quality_floor: number;
      avif_effort_default: number;
      webp_quality: number;
    }>,
  ) => {
    const res = await apiClient.put("/settings/image", payload);
    return res.data as any;
  },
};

// Profile Pictures API
export const profilePictures = {
  list: async (
    params: {
      page?: number;
      per_page?: number;
    } = {},
  ): Promise<ProfilePictureListResponse> => {
    const response = await apiClient.get<ProfilePictureListResponse>(
      "/profile-pictures",
      {
        params,
      },
    );
    return response.data;
  },

  getActive: async (): Promise<ActiveProfilePictureResponse> => {
    const response = await apiClient.get<ActiveProfilePictureResponse>(
      "/profile-pictures/active",
    );
    return response.data;
  },

  getById: async (id: string): Promise<ProfilePicture> => {
    const response = await apiClient.get<ProfilePicture>(
      `/profile-pictures/${id}`,
    );
    return response.data;
  },

  upload: async (
    uploadData: ProfilePictureUploadData,
  ): Promise<ProfilePicture> => {
    const formData = new FormData();
    formData.append("file", uploadData.file);

    if (uploadData.title) {
      formData.append("title", uploadData.title);
    }

    const response = await apiClient.post<ProfilePicture>(
      "/profile-pictures",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  activate: async (id: string): Promise<ProfilePicture> => {
    const response = await apiClient.put<ProfilePicture>(
      `/profile-pictures/${id}/activate`,
    );
    return response.data;
  },

  update: async (
    id: string,
    updates: { title?: string; is_active?: boolean },
  ): Promise<ProfilePicture> => {
    const response = await apiClient.put<ProfilePicture>(
      `/profile-pictures/${id}`,
      updates,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/profile-pictures/${id}`);
  },
};

// Hero Images API
export const heroImages = {
  list: async (): Promise<HeroImage[]> => {
    const response = await apiClient.get<HeroImage[]>("/hero-images");
    return response.data;
  },

  getActive: async (): Promise<HeroImage | null> => {
    try {
      const response = await apiClient.get<HeroImage>("/hero-images/active");
      return response.data;
    } catch {
      // Return null if no active hero image
      return null;
    }
  },

  getById: async (id: string): Promise<HeroImage> => {
    const response = await apiClient.get<HeroImage>(`/hero-images/${id}`);
    return response.data;
  },

  create: async (heroImageData: HeroImageCreate): Promise<HeroImage> => {
    const response = await apiClient.post<HeroImage>(
      "/hero-images",
      heroImageData,
    );
    return response.data;
  },

  update: async (id: string, updates: HeroImageUpdate): Promise<HeroImage> => {
    const response = await apiClient.put<HeroImage>(
      `/hero-images/${id}`,
      updates,
    );
    return response.data;
  },

  updateFocalPoints: async (
    id: string,
    focalPointUpdate: HeroImageFocalPointUpdate,
  ): Promise<HeroImage> => {
    const response = await apiClient.put<HeroImage>(
      `/hero-images/${id}/focal-points`,
      focalPointUpdate,
    );
    return response.data;
  },

  activate: async (id: string): Promise<HeroImage> => {
    const response = await apiClient.post<HeroImage>(
      `/hero-images/${id}/activate`,
      {},
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/hero-images/${id}`);
  },
};

export default apiClient;
export { apiClient };
export const api = apiClient;
