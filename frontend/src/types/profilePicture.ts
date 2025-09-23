export interface ProfilePicture {
  id: string;
  title?: string;
  filename: string;
  original_path: string;
  variants: Record<string, ImageVariant>;
  is_active: boolean;
  file_size?: number;
  width?: number;
  height?: number;
  created_at: string;
  updated_at: string;

  // URL fields populated by API
  original_url?: string;
  download_url?: string;
}

export interface ImageVariant {
  path: string;
  width: number;
  height: number;
  size_bytes: number;
  format: string;
  url?: string;
}

export interface ProfilePictureCreate {
  title?: string;
  is_active?: boolean;
}

export interface ProfilePictureUpdate {
  title?: string;
  is_active?: boolean;
}

export interface ProfilePictureListResponse {
  profile_pictures: ProfilePicture[];
  total: number;
}

export interface ActiveProfilePictureResponse {
  profile_picture: ProfilePicture | null;
}

export interface ProfilePictureUploadData {
  file: File;
  title?: string;
}
