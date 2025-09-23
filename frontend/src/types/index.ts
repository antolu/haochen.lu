export interface Photo {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string;
  comments?: string;
  filename: string;
  original_path: string;
  original_url?: string; // Secure API URL for original file
  download_url?: string; // Download URL for original file

  // Image paths (legacy)
  thumbnail_path?: string;
  webp_path?: string;

  // Responsive image variants
  variants?: Record<
    string,
    {
      path: string;
      filename: string;
      width: number;
      height: number;
      size_bytes: number;
      format: string;
      url?: string; // Secure API URL for accessing the variant
    }
  >;

  // EXIF data
  location_lat?: number;
  location_lon?: number;
  location_name?: string;
  location_address?: string;
  altitude?: number;
  timezone?: string;
  camera_make?: string;
  camera_model?: string;
  camera_display_name?: string; // Display name from alias or fallback to original
  lens?: string;
  lens_display_name?: string; // Display name from alias or fallback to original
  iso?: number;
  aperture?: number;
  shutter_speed?: string;
  focal_length?: number;
  date_taken?: string;

  // Flexible metadata
  custom_metadata?: Record<string, unknown>;

  // Metadata
  file_size: number;
  width: number;
  height: number;
  featured: boolean;
  view_count: number;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface PhotoListResponse {
  photos: Photo[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface Project {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description?: string;
  github_url?: string;
  demo_url?: string;
  image_url?: string;
  technologies?: string;
  featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  published: boolean;
  published_at?: string;
  meta_description?: string;
  featured_image?: string;
  tags?: string;
  category?: string;
  view_count: number;
  read_time?: number;
  created_at: string;
  updated_at: string;
}

export interface BlogPostListResponse {
  posts: BlogPost[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface SubApp {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  url: string;
  is_external: boolean;
  requires_auth: boolean;
  admin_only: boolean;
  show_in_menu: boolean;
  enabled: boolean;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface SubAppListResponse {
  subapps: SubApp[];
  total: number;
}

export interface PhotoStatsSummary {
  total_photos: number;
  featured_photos: number;
  total_size: number;
}

export interface ProjectStatsSummary {
  total_projects: number;
  featured_projects: number;
}

export interface SubAppStatsSummary {
  total_subapps: number;
  enabled_subapps: number;
  disabled_subapps: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  is_admin: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: User;
}

export interface Content {
  id: string;
  key: string;
  title: string;
  content: string;
  content_type: string;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContentCreate {
  key: string;
  title: string;
  content: string;
  content_type?: string;
  category?: string;
  is_active?: boolean;
}

export interface ContentUpdate {
  title?: string;
  content?: string;
  content_type?: string;
  category?: string;
  is_active?: boolean;
}

export interface ContentListResponse {
  content: Content[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ContentKeyValue {
  key: string;
  content: string;
  title: string;
  content_type: string;
}

export interface ApiError {
  detail: string;
  status?: number;
}

// Re-export profile picture types
export * from './profilePicture';
