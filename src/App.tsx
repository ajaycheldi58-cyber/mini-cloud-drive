/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cloud,
  Upload,
  Search,
  LayoutDashboard,
  FolderOpen,
  LogOut,
  Download,
  Edit3,
  Trash2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HardDrive,
  FilePlus2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Menu,
  FolderPlus,
} from 'lucide-react';
import {
  User,
  CloudFile,
  StorageStats,
  SortField,
  SortOrder,
  ActiveTab,
  FileCategory,
  ToastMessage,
} from './types.ts';
import {
  formatBytes,
  formatMegabytes,
  formatDate,
  getReadableFileType,
  getFileCategory,
  isPreviewSupported,
} from './utils/format.ts';
import { AuthView } from './components/AuthView.tsx';
import { FileTypeIcon } from './components/FileTypeIcon.tsx';
import { FilePreviewModal } from './components/FilePreviewModal.tsx';
import { RenameModal } from './components/RenameModal.tsx';
import { DeleteModal } from './components/DeleteModal.tsx';

const TOKEN_STORAGE_KEY = 'minidrive_jwt_token';

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [files, setFiles] = useState<CloudFile[]>([]);
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Search, Filter, and Sort state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Modals state
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [renameTarget, setRenameTarget] = useState<CloudFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CloudFile | null>(null);
  const [quickNoteOpen, setQuickNoteOpen] = useState<boolean>(false);
  const [quickNoteName, setQuickNoteName] = useState<string>('Project-Notes.md');
  const [quickNoteContent, setQuickNoteContent] = useState<string>(
    '# Project Notes\n\nWrite markdown or plain text here to save directly to your Mini Cloud Drive.'
  );

  // Notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const addToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setFiles([]);
    setStorage(null);
    setMobileSidebarOpen(false);
  }, []);

  // Fetch files and storage usage from backend
  const fetchDriveData = useCallback(
    async (authToken: string, showSpinner = false) => {
      if (showSpinner) setLoadingData(true);
      try {
        const [filesRes, storageRes] = await Promise.all([
          fetch(`/api/files?sortBy=${sortBy}&sortOrder=${sortOrder}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
          fetch('/api/storage', {
            headers: { Authorization: `Bearer ${authToken}` },
          }),
        ]);

        if (filesRes.status === 401 || storageRes.status === 401) {
          handleLogout();
          return;
        }

        const filesData = await filesRes.json();
        const storageData = await storageRes.json();

        if (filesRes.ok && Array.isArray(filesData.files)) {
          setFiles(filesData.files);
        }
        if (storageRes.ok && storageData) {
          setStorage(storageData);
        }
      } catch {
        addToast('error', 'Failed to synchronize files with server.');
      } finally {
        if (showSpinner) setLoadingData(false);
      }
    },
    [sortBy, sortOrder, handleLogout, addToast]
  );

  // Verify token on initial load
  useEffect(() => {
    const verifySession = async () => {
      if (!token) {
        setAuthChecking(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        handleLogout();
      } finally {
        setAuthChecking(false);
      }
    };

    verifySession();
  }, [token, handleLogout]);

  // Load files & storage whenever authenticated user or sort order changes
  useEffect(() => {
    if (token && user) {
      fetchDriveData(token, files.length === 0);
    }
  }, [token, user, sortBy, sortOrder, fetchDriveData]);

  const handleAuthenticated = (newToken: string, authUser: User, welcomeMsg: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setUser(authUser);
    addToast('success', welcomeMsg);
  };

  // Upload one or multiple files to POST /api/files
  const uploadFileList = async (selectedFiles: FileList | File[]) => {
    if (!token) return;
    const fileArray = Array.from(selectedFiles);
    if (fileArray.length === 0) return;

    // Client-side pre-check against remaining quota
    if (storage) {
      const totalIncomingBytes = fileArray.reduce((acc, f) => acc + f.size, 0);
      if (totalIncomingBytes > storage.remaining_bytes) {
        addToast(
          'error',
          `Upload rejected: Selected files (${formatMegabytes(totalIncomingBytes)}) exceed your remaining ${formatMegabytes(storage.remaining_bytes)} quota.`
        );
        return;
      }
    }

    const formData = new FormData();
    for (const file of fileArray) {
      formData.append('files', file);
    }

    setUploading(true);
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'File upload failed.');
      }

      addToast('success', data.message || 'Files uploaded successfully.');
      await fetchDriveData(token, false);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Error uploading files.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFileList(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFileList(e.dataTransfer.files);
    }
  };

  // Create and upload a text/markdown file directly from browser
  const handleCreateQuickNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickNoteName.trim() || 'Untitled-Note.txt';
    const ext = cleanName.split('.').pop()?.toLowerCase();
    const mimeType =
      ext === 'md'
        ? 'text/markdown'
        : ext === 'json'
        ? 'application/json'
        : ext === 'csv'
        ? 'text/csv'
        : 'text/plain';

    const blob = new Blob([quickNoteContent], { type: mimeType });
    const fileObj = new File([blob], cleanName, { type: mimeType });
    setQuickNoteOpen(false);
    await uploadFileList([fileObj]);
  };

  // Download file via GET /api/files/:id/download
  const handleDownload = async (file: CloudFile) => {
    if (!token) return;
    try {
      addToast('info', `Preparing "${file.display_name}" for download...`);
      const res = await fetch(`/api/files/${file.id}/download`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Download failed.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.display_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast('success', `Downloaded "${file.display_name}".`);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Unable to download file.');
    }
  };

  // Rename file via PUT /api/files/:id
  const handleRenameFile = async (fileId: number, newDisplayName: string) => {
    if (!token) return;
    const res = await fetch(`/api/files/${fileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ display_name: newDisplayName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to rename file.');
    }

    addToast('success', data.message || 'File renamed.');
    await fetchDriveData(token, false);
  };

  // Delete file via DELETE /api/files/:id
  const handleDeleteFile = async (fileId: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete file.');
      }

      addToast('success', data.message || 'File deleted.');
      await fetchDriveData(token, false);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Could not delete file.');
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  // Filter files by search query and category
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      !searchQuery.trim() ||
      file.display_name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || getFileCategory(file) === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (authChecking) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading Mini Cloud Drive...</p>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  const usedBytes = storage?.used_bytes ?? 0;
  const quotaBytes = storage?.quota_bytes ?? user.quota_bytes ?? 104857600;
  const remainingBytes = storage?.remaining_bytes ?? Math.max(0, quotaBytes - usedBytes);
  const percentageUsed = storage?.percentage_used ?? 0;
  const isNearQuota = percentageUsed >= 85;

  const userInitials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Hidden Multi-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
        {/* Left: Mobile Menu Trigger + Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Mini Cloud Drive
            </span>
          </button>
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your files by name..."
              aria-label="Search files by name"
              className="w-full pl-10 pr-9 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right: User Profile + Logout Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center shrink-0">
              {userInitials}
            </div>
            <div className="text-left leading-tight hidden md:block">
              <p className="text-xs font-semibold text-slate-900 truncate max-w-[140px]">
                {user.name}
              </p>
              <p className="text-[11px] text-slate-500 truncate max-w-[160px]">
                {user.email}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-red-600 border border-slate-200 hover:border-red-200 hover:bg-red-50/50 rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Workspace Body: Sidebar + Main Viewport */}
      <div className="flex-1 flex relative">
        {/* Mobile Sidebar Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-20 w-64 bg-slate-50/70 border-r border-slate-200 flex flex-col justify-between p-4 transition-transform duration-150 ease-out ${
            mobileSidebarOpen ? 'translate-x-0 bg-white' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="space-y-6">
            {/* Prominent Upload CTA */}
            <div className="space-y-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Files</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQuickNoteOpen(true)}
                className="w-full py-2 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-purple-600" />
                <span>New Text / Markdown File</span>
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('files');
                  setMobileSidebarOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'files'
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span>My Files</span>
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {files.length}
                </span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50/60 flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Logout</span>
              </button>
            </nav>
          </div>

          {/* Sidebar Storage Meter */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                <span>Storage Quota</span>
              </span>
              <span className="font-mono tabular-nums text-slate-600">
                {percentageUsed.toFixed(1)}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isNearQuota ? 'bg-red-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'
                }`}
                style={{ width: `${Math.max(percentageUsed > 0 ? 2 : 0, Math.min(100, percentageUsed))}%` }}
              />
            </div>

            <div className="text-xs text-slate-500 font-mono tabular-nums space-y-0.5">
              <p className="text-slate-700 font-medium">
                {formatBytes(usedBytes)} of {formatBytes(quotaBytes)} used
              </p>
              <p>{formatBytes(remainingBytes)} available</p>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8">
          {/* Toast Notification Stack */}
          {toasts.length > 0 && (
            <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start justify-between gap-3 text-xs font-medium ${
                    t.type === 'success'
                      ? 'bg-white border-emerald-200 text-slate-800'
                      : t.type === 'error'
                      ? 'bg-white border-red-200 text-red-700'
                      : 'bg-white border-blue-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {t.type === 'success' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    )}
                    {t.type === 'error' && (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    {t.type === 'info' && (
                      <Cloud className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{t.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeToast(t.id)}
                    className="text-slate-400 hover:text-slate-700 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <p className="text-xs font-semibold text-blue-600">
                {activeTab === 'dashboard' ? 'Cloud Workspace Overview' : 'Personal File Vault'}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-0.5">
                {activeTab === 'dashboard'
                  ? `Welcome back, ${user.name.split(' ')[0]}`
                  : 'My Files'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {activeTab === 'dashboard'
                  ? 'Upload files, monitor your 100 MB storage quota, and access your stored documents.'
                  : 'Browse, search, sort, preview, rename, and download your personal cloud files.'}
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setQuickNoteOpen(true)}
                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <FilePlus2 className="w-4 h-4 text-purple-600" />
                <span>Create Note</span>
              </button>

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Upload Files</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Dashboard KPI & Storage Summary Section */}
          {activeTab === 'dashboard' && (
            <section className="space-y-6">
              {/* 3-Column Metrics + Storage Progress Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-xs font-medium text-slate-500">Total Stored Files</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {storage?.total_files ?? files.length}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Private to {user.email}
                  </p>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-xs font-medium text-slate-500">Storage Used</p>
                  <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {formatBytes(usedBytes)}
                  </p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums mt-2">
                    {percentageUsed.toFixed(2)}% of {formatBytes(quotaBytes)} quota
                  </p>
                </div>

                <div className="p-5 bg-white border border-slate-200 rounded-2xl">
                  <p className="text-xs font-medium text-slate-500">Remaining Capacity</p>
                  <p className="text-2xl font-bold text-blue-600 font-mono tabular-nums mt-1">
                    {formatBytes(remainingBytes)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Max {formatBytes(quotaBytes)} per user account
                  </p>
                </div>
              </div>

              {/* Storage Quota Bar & Category Breakdown */}
              <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Storage Allocation</h2>
                    <p className="text-xs text-slate-500">
                      Uploads exceeding your 100 MB limit are automatically rejected by the server.
                    </p>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-700">
                    <span className="font-semibold text-slate-900">{formatBytes(usedBytes)}</span>
                    <span> / {formatBytes(quotaBytes)}</span>
                  </div>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-200 ${
                      isNearQuota ? 'bg-red-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'
                    }`}
                    style={{
                      width: `${Math.max(percentageUsed > 0 ? 1.5 : 0, Math.min(100, percentageUsed))}%`,
                    }}
                  />
                </div>

                {storage && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500">Documents &amp; Data</span>
                      <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {formatBytes(storage.breakdown.documents_bytes)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Images &amp; Graphics</span>
                      <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {formatBytes(storage.breakdown.images_bytes)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Video &amp; Audio</span>
                      <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {formatBytes(storage.breakdown.media_bytes)}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Archives &amp; Other</span>
                      <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                        {formatBytes(storage.breakdown.other_bytes)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Drag-and-Drop Upload Area */}
          <section
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-colors cursor-pointer ${
              isDraggingOver
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-slate-50'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              {uploading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {uploading
                ? 'Uploading files to your personal cloud drive...'
                : isDraggingOver
                ? 'Drop your files here to upload immediately'
                : 'Drag and drop files here, or click to browse'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Upload single or multiple files at once. Remaining storage:{' '}
              <span className="font-mono tabular-nums font-medium text-slate-700">
                {formatBytes(remainingBytes)}
              </span>
            </p>
          </section>

          {/* File Management Section */}
          <section className="space-y-4">
            {/* Filter & Sort Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Category Segmented Filter */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All Files' },
                    { id: 'documents', label: 'Documents' },
                    { id: 'images', label: 'Images' },
                    { id: 'media', label: 'Media' },
                    { id: 'other', label: 'Other' },
                  ] as { id: FileCategory; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedCategory === tab.id
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span className="text-slate-500 font-medium">Sort by:</span>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  {(
                    [
                      { field: 'date', label: 'Upload Date' },
                      { field: 'name', label: 'Name' },
                      { field: 'size', label: 'Size' },
                    ] as { field: SortField; label: string }[]
                  ).map((item) => {
                    const isActive = sortBy === item.field;
                    return (
                      <button
                        key={item.field}
                        type="button"
                        onClick={() => toggleSort(item.field)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-white text-blue-600 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isActive ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : (
                            <ArrowDown className="w-3 h-3" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-40" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* File Table / Empty State / Loading State */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              {loadingData ? (
                <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                  <p className="text-sm font-medium">Loading your files...</p>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="p-12 text-center max-w-md mx-auto">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <FolderPlus className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {files.length === 0
                      ? 'Your cloud drive is empty'
                      : 'No matching files found'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {files.length === 0
                      ? 'Upload documents, images, spreadsheets, or archives to access them securely from anywhere.'
                      : `No files match "${searchQuery}" in the selected category.`}
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-2.5">
                    {files.length === 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Your First File</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickNoteOpen(true)}
                          className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <FilePlus2 className="w-3.5 h-3.5 text-purple-600" />
                          <span>Create Quick Note</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedCategory('all');
                        }}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        Reset Search &amp; Filters
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                        <th className="py-3.5 pl-5 pr-3">File Name</th>
                        <th className="py-3.5 px-3 hidden sm:table-cell">Type</th>
                        <th className="py-3.5 px-3 text-right">Size</th>
                        <th className="py-3.5 px-3 hidden md:table-cell text-right">Uploaded</th>
                        <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {filteredFiles.map((file) => {
                        const canPreview = isPreviewSupported(file) !== null;
                        return (
                          <tr
                            key={file.id}
                            className="hover:bg-slate-50/90 transition-colors group"
                          >
                            {/* File Name + Icon */}
                            <td className="py-3 pl-5 pr-3 max-w-[220px] sm:max-w-[320px] lg:max-w-[420px]">
                              <div className="flex items-center gap-3">
                                <FileTypeIcon file={file} />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="font-semibold text-slate-900 hover:text-blue-600 truncate block max-w-full text-left transition-colors cursor-pointer"
                                    title={file.display_name}
                                  >
                                    {file.display_name}
                                  </button>
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500 sm:hidden font-mono tabular-nums mt-0.5">
                                    <span>{getReadableFileType(file)}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{formatBytes(file.size_bytes)}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* File Type */}
                            <td className="py-3 px-3 hidden sm:table-cell text-xs text-slate-600 whitespace-nowrap">
                              {getReadableFileType(file)}
                            </td>

                            {/* File Size */}
                            <td className="py-3 px-3 text-right text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap">
                              {formatBytes(file.size_bytes)}
                            </td>

                            {/* Uploaded Date */}
                            <td className="py-3 px-3 hidden md:table-cell text-right text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {formatDate(file.uploaded_at)}
                            </td>

                            {/* File Management Actions */}
                            <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setPreviewFile(file)}
                                  title={canPreview ? 'Preview file' : 'File details'}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Preview</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDownload(file)}
                                  title="Download file"
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">Download</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setRenameTarget(file)}
                                  title="Rename file"
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">Rename</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(file)}
                                  title="Delete file"
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span className="hidden xl:inline">Delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Quick Text/Markdown Note Creation Modal */}
      {quickNoteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <FilePlus2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create &amp; Upload Text File</h3>
                  <p className="text-xs text-slate-500">Save a Markdown, CSV, JSON, or text file directly to your drive</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickNoteOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickNote} className="space-y-4">
              <div>
                <label htmlFor="quick-note-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  File Name
                </label>
                <input
                  id="quick-note-name"
                  type="text"
                  required
                  value={quickNoteName}
                  onChange={(e) => setQuickNoteName(e.target.value)}
                  placeholder="example-notes.md"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label htmlFor="quick-note-content" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  File Content
                </label>
                <textarea
                  id="quick-note-content"
                  rows={6}
                  required
                  value={quickNoteContent}
                  onChange={(e) => setQuickNoteContent(e.target.value)}
                  className="w-full p-3.5 text-xs font-mono bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickNoteOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
                >
                  Save to Cloud Drive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        token={token}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
      />

      {/* Rename Modal */}
      <RenameModal
        file={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirmRename={handleRenameFile}
      />

      {/* Delete Confirmation Modal */}
      <DeleteModal
        file={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirmDelete={handleDeleteFile}
      />
    </div>
  );
}
