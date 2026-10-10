export interface User {
  id: number;
  name: string;
  email: string;
  quota_bytes: number;
}

export interface CloudFile {
  id: number;
  user_id: number;
  display_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

export interface StorageBreakdown {
  images_bytes: number;
  documents_bytes: number;
  media_bytes: number;
  other_bytes: number;
}

export interface StorageStats {
  used_bytes: number;
  quota_bytes: number;
  remaining_bytes: number;
  total_files: number;
  percentage_used: number;
  breakdown: StorageBreakdown;
}

export type SortField = 'date' | 'name' | 'size';
export type SortOrder = 'asc' | 'desc';
export type ActiveTab = 'dashboard' | 'files';
export type FileCategory = 'all' | 'documents' | 'images' | 'media' | 'other';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}
