export interface Photo {
  id: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string;
  comments?: string;
  filename: string;
  original_path: string;

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
  lens?: string;
  iso?: number;
  aperture?: number;
  shutter_speed?: string;
  focal_length?: number;
  date_taken?: string;

  // Flexible metadata
  metadata?: Record<string, any>;

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

export interface ApiError {
  detail: string;
  status?: number;
}
