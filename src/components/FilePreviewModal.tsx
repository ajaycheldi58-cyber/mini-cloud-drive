import React, { useEffect, useState } from 'react';
import { X, Download, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { CloudFile } from '../types.ts';
import { formatBytes, formatDate, getReadableFileType, isPreviewSupported, getFileExtension } from '../utils/format.ts';

interface FilePreviewModalProps {
  file: CloudFile | null;
  token: string;
  onClose: () => void;
  onDownload: (file: CloudFile) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  token,
  onClose,
  onDownload,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;

    const previewKind = isPreviewSupported(file);
    if (!previewKind) {
      setObjectUrl(null);
      setTextContent(null);
      setError(null);
      return;
    }

    let active = true;
    let createdUrl: string | null = null;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setObjectUrl(null);
      setTextContent(null);

      try {
        const res = await fetch(`/api/files/${file.id}/download?inline=1`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Could not load file preview.');
        }

        const blob = await res.blob();
        if (!active) return;

        if (previewKind === 'text') {
          const text = await blob.text();
          if (!active) return;
          setTextContent(text.slice(0, 100000));
        } else {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Preview failed to load.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file, token]);

  if (!file) return null;

  const previewKind = isPreviewSupported(file);
  const isCsv = getFileExtension(file.display_name) === 'CSV' || file.mime_type.includes('csv');

  const parseCsvRows = (csvText: string): string[][] => {
    return csvText
      .trim()
      .split(/\r?\n/)
      .slice(0, 50)
      .map((line) => line.split(',').map((cell) => cell.trim()));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 truncate">
              {file.display_name}
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              <span>{getReadableFileType(file)}</span>
              <span aria-hidden="true">·</span>
              <span>{formatBytes(file.size_bytes)}</span>
              <span aria-hidden="true">·</span>
              <span>Uploaded {formatDate(file.uploaded_at)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onDownload(file)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50 flex items-center justify-center min-h-[320px]">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
              <span className="text-sm font-medium">Loading file preview...</span>
            </div>
          )}

          {!loading && error && (
            <div className="max-w-md text-center p-6 bg-white border border-red-200 rounded-xl">
              <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">Unable to load preview</p>
              <p className="text-xs text-slate-500 mt-1">{error}</p>
            </div>
          )}

          {!loading && !error && !previewKind && (
            <div className="max-w-md text-center p-8 bg-white border border-slate-200 rounded-2xl">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">
                Direct browser preview not available
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                This file format ({file.mime_type || 'binary'}) cannot be rendered inline, but you can download it directly to your device.
              </p>
              <button
                type="button"
                onClick={() => onDownload(file)}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download File ({formatBytes(file.size_bytes)})</span>
              </button>
            </div>
          )}

          {!loading && !error && previewKind === 'image' && objectUrl && (
            <div className="w-full flex items-center justify-center">
              <img
                src={objectUrl}
                alt={file.display_name}
                referrerPolicy="no-referrer"
                className="max-h-[65vh] max-w-full object-contain rounded-xl border border-slate-200 bg-white shadow-xs"
              />
            </div>
          )}

          {!loading && !error && previewKind === 'text' && textContent !== null && (
            <div className="w-full self-stretch">
              {isCsv ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <tbody>
                        {parseCsvRows(textContent).map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={
                              rIdx === 0
                                ? 'bg-slate-100 font-semibold text-slate-900 border-b border-slate-200'
                                : 'border-b border-slate-100 text-slate-700'
                            }
                          >
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} className="px-3.5 py-2.5 font-mono tabular-nums whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <pre className="w-full p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                    {textContent}
                  </pre>
                </div>
              ) : (
                <pre className="w-full p-5 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {textContent || '(Empty text file)'}
                </pre>
              )}
            </div>
          )}

          {!loading && !error && previewKind === 'pdf' && objectUrl && (
            <iframe
              src={objectUrl}
              title={file.display_name}
              className="w-full h-[65vh] rounded-xl border border-slate-200 bg-white"
            />
          )}

          {!loading && !error && previewKind === 'audio' && objectUrl && (
            <div className="w-full max-w-md p-6 bg-white border border-slate-200 rounded-2xl text-center">
              <p className="text-sm font-semibold text-slate-900 mb-4">{file.display_name}</p>
              <audio controls src={objectUrl} className="w-full" />
            </div>
          )}

          {!loading && !error && previewKind === 'video' && objectUrl && (
            <video
              controls
              src={objectUrl}
              className="max-h-[65vh] max-w-full rounded-xl border border-slate-200 bg-black"
            />
          )}
        </div>
      </div>
    </div>
  );
};
