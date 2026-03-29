import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import type {
  Photo,
  PhotoListResponse,
  Project,
  ProjectListResponse,
  BlogPost,
  BlogPostListResponse,
  Application,
  ApplicationListResponse,
  PhotoStatsSummary,
  ProjectStatsSummary,
  ApplicationStatsSummary,
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

    // Don't intercept 401s from login requests - let them pass through normally
    const isLoginRequest = originalRequest.url?.includes("/auth/login");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isLoginRequest
    ) {
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

        if (!isPublicPage && !isAuthRefresh) {
          const next = encodeURIComponent(window.location.pathname);
          window.location.href = `/api/auth/login?next=${next}`;
        }

        return Promise.reject(new Error("Refresh failed"));
      }
    }

    return Promise.reject(error);
  },
);

// Auth API
export const auth = {
  getLoginUrl: async (params: LoginRequest = {}): Promise<{ url: string }> => {
    const response = await apiClient.get<{ url: string }>("/auth/login", {
      params,
    });
    return response.data;
  },

  login: async (params: LoginRequest = {}): Promise<void> => {
    const { url } = await auth.getLoginUrl(params);
    window.location.assign(url);
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

  refresh: async (): Promise<TokenResponse> => {
    const response = await apiClient.post<TokenResponse>("/auth/refresh");
    return response.data;
  },

  authorize: async (params: {
    client_id: string;
    redirect_uri: string;
    response_type: string;
    state: string;
  }): Promise<{ url: string }> => {
    const response = await apiClient.get<{ url: string }>("/auth/authorize", {
      params,
    });
    return response.data;
  },
};

// Photos API
export const photos = {
  list: async (
    params: {
      page?: number;
      per_page?: number;
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
      tags?: string;
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
      order_by?: string;
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

  // Project images
  images: {
    list: async (projectId: string) => {
      const res = await apiClient.get(`/projects/${projectId}/images`);
      return res.data as Array<{
        id: string;
        project_id: string;
        // photo_id removed in new model
        title?: string | null;
        alt_text?: string | null;
        order: number;
      }>;
    },
    // attach removed in favor of upload
    upload: async (
      projectId: string,
      file: File,
      metadata: { title?: string; alt_text?: string } = {},
    ) => {
      const formData = new FormData();
      formData.append("file", file);

      if (metadata.title) {
        formData.append("title", metadata.title);
      }
      if (metadata.alt_text) {
        formData.append("alt_text", metadata.alt_text);
      }

      const res = await apiClient.post(
        `/projects/${projectId}/images/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return res.data as {
        id: string;
        project_id: string;
        title?: string | null;
        alt_text?: string | null;
        order: number;
        photo?: {
          original_url?: string;
          variants?: Record<string, { url?: string }>;
        };
      };
    },
    remove: async (projectImageId: string) => {
      await apiClient.delete(`/projects/images/${projectImageId}`);
    },
    reorder: async (
      projectId: string,
      items: { id: string; order: number }[],
      normalize = true,
    ) => {
      const res = await apiClient.post(
        `/projects/${projectId}/images/reorder`,
        {
          items,
          normalize,
        },
      );
      return res.data as { message: string };
    },
  },

  reorder: async (
    items: { id: string; order: number }[],
    normalize = true,
  ): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>(
      `/projects/reorder`,
      {
        items,
        normalize,
      },
    );
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

// Applications API
export const applications = {
  list: async (menuOnly = true): Promise<ApplicationListResponse> => {
    try {
      const response = await apiClient.get<ApplicationListResponse>(
        "/applications",
        {
          params: { menu_only: menuOnly },
        },
      );
      return response.data;
    } catch {
      // Return empty response as fallback
      return { applications: [], total: 0 };
    }
  },

  listAuthenticated: async (
    menuOnly = true,
  ): Promise<ApplicationListResponse> => {
    try {
      const response = await apiClient.get<ApplicationListResponse>(
        "/applications/authenticated",
        {
          params: { menu_only: menuOnly },
        },
      );
      return response.data;
    } catch {
      // Return empty response as fallback
      return { applications: [], total: 0 };
    }
  },

  listAll: async (): Promise<ApplicationListResponse> => {
    const response = await apiClient.get<ApplicationListResponse>(
      "/applications/admin",
    );
    return response.data;
  },

  getByIdOrSlug: async (identifier: string): Promise<Application> => {
    const response = await apiClient.get<Application>(
      `/applications/${identifier}`,
    );
    return response.data;
  },

  create: async (
    application: Omit<Application, "id" | "slug" | "created_at" | "updated_at">,
  ): Promise<Application> => {
    const response = await apiClient.post<Application>(
      "/applications",
      application,
    );
    return response.data;
  },

  update: async (
    id: string,
    updates: Partial<Application>,
  ): Promise<Application> => {
    const response = await apiClient.put<Application>(
      `/applications/${id}`,
      updates,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/applications/${id}`);
  },

  reorder: async (
    items: Array<{ id: string; order: number }>,
    normalize = true,
  ): Promise<void> => {
    await apiClient.post("/applications/reorder", { items, normalize });
  },

  regenerateCredentials: async (id: string): Promise<Application> => {
    const response = await apiClient.post<Application>(
      `/applications/${id}/regenerate-credentials`,
    );
    return response.data;
  },

  getStats: async (): Promise<ApplicationStatsSummary> => {
    const response = await apiClient.get<ApplicationStatsSummary>(
      "/applications/stats/summary",
    );
    return response.data;
  },

  getJumpUrl: async (
    slug: string,
    target: "app" | "admin" = "app",
  ): Promise<{ url: string }> => {
    const response = await apiClient.get<{ url: string }>(
      `/auth/jump/${slug}`,
      {
        params: { target },
      },
    );
    return response.data;
  },

  exportYaml: async (id: string, slug: string): Promise<void> => {
    const response = await apiClient.get<Blob>(`/applications/${id}/export`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}.yml`;
    a.click();
    URL.revokeObjectURL(url);
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
    const res = await apiClient.get<{
      responsive_sizes: Record<string, number>;
      quality_settings: Record<string, number>;
      avif_quality_base_offset: number;
      avif_quality_floor: number;
      avif_effort_default: number;
      webp_quality: number;
    }>("/settings/image");
    return res.data;
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
    const res = await apiClient.put<{
      responsive_sizes: Record<string, number>;
      quality_settings: Record<string, number>;
      avif_quality_base_offset: number;
      avif_quality_floor: number;
      avif_effort_default: number;
      webp_quality: number;
    }>("/settings/image", payload);
    return res.data;
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
