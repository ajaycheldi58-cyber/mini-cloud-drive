import { CloudFile, FileCategory } from '../types.ts';

export function formatBytes(bytes: number, decimals = 2): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  const value = bytes / Math.pow(k, i);
  return `${value.toFixed(i === 0 ? 0 : dm)} ${sizes[i]}`;
}

export function formatMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb > 0 && mb < 0.01) {
    return '< 0.01 MB';
  }
  return `${mb.toFixed(2)} MB`;
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) return '';
  return filename.slice(lastDot + 1).toUpperCase();
}

export function getReadableFileType(file: CloudFile): string {
  const ext = getFileExtension(file.display_name);
  const mime = (file.mime_type || '').toLowerCase();

  if (mime.startsWith('image/')) {
    return ext ? `${ext} Image` : 'Image';
  }
  if (mime === 'application/pdf' || ext === 'PDF') {
    return 'PDF Document';
  }
  if (mime.includes('csv') || ext === 'CSV') {
    return 'CSV Spreadsheet';
  }
  if (mime.includes('markdown') || ext === 'MD') {
    return 'Markdown Doc';
  }
  if (mime.includes('json') || ext === 'JSON') {
    return 'JSON Data';
  }
  if (mime.startsWith('text/')) {
    return ext ? `${ext} Text` : 'Text Document';
  }
  if (mime.startsWith('video/')) {
    return ext ? `${ext} Video` : 'Video';
  }
  if (mime.startsWith('audio/')) {
    return ext ? `${ext} Audio` : 'Audio';
  }
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed') || ['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) {
    return ext ? `${ext} Archive` : 'Archive';
  }
  return ext ? `${ext} File` : file.mime_type || 'Binary File';
}

export function getFileCategory(file: CloudFile): Exclude<FileCategory, 'all'> {
  const mime = (file.mime_type || '').toLowerCase();
  const ext = getFileExtension(file.display_name).toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'images';
  }
  if (
    mime.includes('pdf') ||
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('csv') ||
    mime.includes('word') ||
    mime.includes('spreadsheet') ||
    mime.includes('presentation') ||
    ['md', 'txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts'].includes(ext)
  ) {
    return 'documents';
  }
  if (mime.startsWith('video/') || mime.startsWith('audio/') || ['mp4', 'webm', 'mp3', 'wav', 'ogg'].includes(ext)) {
    return 'media';
  }
  return 'other';
}

export function isPreviewSupported(file: CloudFile): 'image' | 'text' | 'pdf' | 'audio' | 'video' | null {
  const mime = (file.mime_type || '').toLowerCase();
  const ext = getFileExtension(file.display_name).toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) {
    return 'audio';
  }
  if (mime.startsWith('video/') || ['mp4', 'webm'].includes(ext)) {
    return 'video';
  }
  if (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    mime.includes('csv') ||
    mime.includes('xml') ||
    mime.includes('javascript') ||
    ['txt', 'md', 'csv', 'json', 'xml', 'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'yml', 'yaml', 'log'].includes(ext)
  ) {
    return 'text';
  }
  return null;
}
