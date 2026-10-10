import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { CloudFile } from '../types.ts';
import { formatBytes } from '../utils/format.ts';

interface DeleteModalProps {
  file: CloudFile | null;
  onClose: () => void;
  onConfirmDelete: (fileId: number) => Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  file,
  onClose,
  onConfirmDelete,
}) => {
  const [deleting, setDeleting] = useState(false);

  if (!file) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirmDelete(file.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete File Permanently</h3>
              <p className="text-xs text-slate-500">Removes file from database and server disk</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-slate-900 break-all">&ldquo;{file.display_name}&rdquo;</span>{' '}
          ({formatBytes(file.size_bytes)})? This action cannot be undone and will immediately free up{' '}
          <span className="font-mono tabular-nums font-medium">{formatBytes(file.size_bytes)}</span> of your storage quota.
        </p>

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{deleting ? 'Deleting...' : 'Delete Permanently'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
