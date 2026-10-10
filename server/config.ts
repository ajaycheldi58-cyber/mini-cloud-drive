import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

export const PORT = Number(process.env.PORT) || 3000;
export const JWT_SECRET = process.env.JWT_SECRET || 'mini-cloud-drive-super-secret-jwt-key-2026';
export const JWT_EXPIRES_IN = '7d';

// Default storage limit: 100 MB per user (104,857,600 bytes)
export const DEFAULT_QUOTA_BYTES = Number(process.env.DEFAULT_QUOTA_BYTES) || 100 * 1024 * 1024;

// Maximum single file upload size: 100 MB (still constrained by user's remaining quota)
export const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_BYTES) || 100 * 1024 * 1024;

export const UPLOADS_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads');
export const DATA_DIR = path.resolve(process.cwd(), './data');
export const DB_FILE = path.resolve(process.cwd(), process.env.DB_FILE || './data/minidrive.sqlite');

// Ensure storage and database directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Blocked unsafe executable extensions for security
export const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.msi',
  '.com',
  '.scr',
  '.pif',
  '.vbs',
  '.wsf',
  '.cpl',
  '.jar',
]);

export function isAllowedFile(originalName: string, mimeType: string): { valid: boolean; reason?: string } {
  const ext = path.extname(originalName).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `Executable or unsafe file type (${ext}) is not permitted for security reasons.`,
    };
  }
  if (!originalName || originalName.trim().length === 0) {
    return {
      valid: false,
      reason: 'File name cannot be empty.',
    };
  }
  if (mimeType === 'application/x-msdownload' || mimeType === 'application/x-dosexec') {
    return {
      valid: false,
      reason: 'Windows executable binary files are not permitted.',
    };
  }
  return { valid: true };
}
