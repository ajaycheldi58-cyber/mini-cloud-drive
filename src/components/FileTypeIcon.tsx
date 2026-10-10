import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Film,
  Music,
  File as FileIcon,
} from 'lucide-react';
import { CloudFile } from '../types.ts';
import { getFileExtension } from '../utils/format.ts';

interface FileTypeIconProps {
  file: CloudFile;
}

export const FileTypeIcon: React.FC<FileTypeIconProps> = ({ file }) => {
  const mime = (file.mime_type || '').toLowerCase();
  const ext = getFileExtension(file.display_name).toLowerCase();

  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
        <ImageIcon className="w-4 h-4" />
      </div>
    );
  }

  if (mime.includes('csv') || mime.includes('spreadsheet') || ['csv', 'xls', 'xlsx'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
        <FileSpreadsheet className="w-4 h-4" />
      </div>
    );
  }

  if (
    mime.includes('json') ||
    mime.includes('javascript') ||
    mime.includes('xml') ||
    ['json', 'js', 'ts', 'tsx', 'jsx', 'html', 'css', 'py', 'sql', 'yml', 'yaml'].includes(ext)
  ) {
    return (
      <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
        <FileCode className="w-4 h-4" />
      </div>
    );
  }

  if (mime.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
        <Film className="w-4 h-4" />
      </div>
    );
  }

  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
        <Music className="w-4 h-4" />
      </div>
    );
  }

  if (mime.includes('zip') || mime.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
        <FileArchive className="w-4 h-4" />
      </div>
    );
  }

  if (mime.startsWith('text/') || mime.includes('pdf') || ['md', 'txt', 'pdf', 'doc', 'docx'].includes(ext)) {
    return (
      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
      <FileIcon className="w-4 h-4" />
    </div>
  );
};
