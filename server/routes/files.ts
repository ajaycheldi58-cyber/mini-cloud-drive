import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UPLOADS_DIR, MAX_FILE_SIZE_BYTES, isAllowedFile } from '../config.ts';
import { queryAll, queryOne, runStatement, DbFile } from '../db.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ApiError } from '../middleware/errorHandler.ts';

const router = Router();

// Sanitize display filename so it cannot contain path traversal characters or control chars
function sanitizeDisplayName(name: string): string {
  const base = path.basename(name).replace(/[\x00-\x1f\x80-\x9f/\\]/g, '').trim();
  return base.slice(0, 255) || 'Untitled-File';
}

// Safely resolve a stored filename inside UPLOADS_DIR and verify no path traversal
function resolveSafeDiskPath(storedName: string): string {
  const safeBase = path.basename(storedName);
  if (safeBase !== storedName || storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    throw new ApiError(400, 'Unsafe file reference detected.');
  }
  const resolved = path.resolve(UPLOADS_DIR, safeBase);
  const uploadsRoot = path.resolve(UPLOADS_DIR);
  if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
    throw new ApiError(403, 'Access outside storage directory is forbidden.');
  }
  return resolved;
}

// Configure Multer disk storage with random UUID internal names
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = rawExt.length <= 12 ? rawExt : '';
    const uniqueStoredName = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueStoredName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    const check = isAllowedFile(file.originalname, file.mimetype);
    if (!check.valid) {
      cb(new ApiError(400, check.reason || 'File type is not allowed.'));
      return;
    }
    cb(null, true);
  },
});

function cleanupUploadedDiskFiles(files: Express.Multer.File[]): void {
  for (const file of files) {
    try {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Protect all /api/files routes with JWT authentication
router.use(requireAuth);

// GET /api/files
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const sortBy = typeof req.query.sortBy === 'string' ? req.query.sortBy : 'date';
    const sortOrder = req.query.sortOrder === 'asc' ? 'ASC' : 'DESC';

    let orderClause = 'uploaded_at DESC';
    if (sortBy === 'name') {
      orderClause = `LOWER(display_name) ${sortOrder}`;
    } else if (sortBy === 'size') {
      orderClause = `size_bytes ${sortOrder}`;
    } else {
      orderClause = `uploaded_at ${sortOrder}`;
    }

    let files = queryAll<DbFile>(
      `SELECT id, user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM files
       WHERE user_id = ?
       ORDER BY ${orderClause}`,
      [userId]
    );

    if (search) {
      files = files.filter((f) => String(f.display_name).toLowerCase().includes(search));
    }

    // Do not expose raw disk paths; return clean file metadata
    const formatted = files.map((f) => ({
      id: Number(f.id),
      user_id: Number(f.user_id),
      display_name: String(f.display_name),
      stored_name: String(f.stored_name),
      mime_type: String(f.mime_type),
      size_bytes: Number(f.size_bytes),
      uploaded_at: String(f.uploaded_at),
    }));

    res.json({ files: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /api/files
router.post(
  '/',
  upload.array('files', 20),
  (req: Request, res: Response, next: NextFunction) => {
    const uploadedFiles = (req.files as Express.Multer.File[]) || [];

    try {
      const user = req.user!;

      if (!uploadedFiles || uploadedFiles.length === 0) {
        throw new ApiError(400, 'Please select at least one file to upload.');
      }

      // Validate every file and calculate total incoming bytes
      let incomingBytes = 0;
      for (const file of uploadedFiles) {
        const validation = isAllowedFile(file.originalname, file.mimetype);
        if (!validation.valid) {
          throw new ApiError(400, validation.reason || 'Invalid file type.');
        }
        if (file.size <= 0) {
          throw new ApiError(400, `File "${file.originalname}" is empty (0 bytes).`);
        }
        incomingBytes += file.size;
      }

      // Check user's current storage usage against their quota (100 MB default)
      const usageRow = queryOne<{ used: number }>(
        'SELECT COALESCE(SUM(size_bytes), 0) as used FROM files WHERE user_id = ?',
        [user.id]
      );
      const currentUsedBytes = usageRow ? Number(usageRow.used) : 0;
      const quotaBytes = Number(user.quota_bytes);
      const remainingBytes = Math.max(0, quotaBytes - currentUsedBytes);

      if (currentUsedBytes + incomingBytes > quotaBytes) {
        cleanupUploadedDiskFiles(uploadedFiles);
        const neededMB = (incomingBytes / (1024 * 1024)).toFixed(2);
        const remainingMB = (remainingBytes / (1024 * 1024)).toFixed(2);
        throw new ApiError(
          413,
          `Storage quota exceeded. Upload requires ${neededMB} MB, but you only have ${remainingMB} MB remaining of your 100 MB limit.`
        );
      }

      const createdFiles = [];
      const nowIso = new Date().toISOString();

      for (const file of uploadedFiles) {
        const displayName = sanitizeDisplayName(file.originalname);
        const mimeType = file.mimetype || 'application/octet-stream';
        const { lastInsertId } = runStatement(
          `INSERT INTO files (user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [user.id, displayName, file.filename, mimeType, file.size, nowIso]
        );

        createdFiles.push({
          id: lastInsertId,
          user_id: user.id,
          display_name: displayName,
          stored_name: file.filename,
          mime_type: mimeType,
          size_bytes: file.size,
          uploaded_at: nowIso,
        });
      }

      res.status(201).json({
        message:
          createdFiles.length === 1
            ? `"${createdFiles[0].display_name}" uploaded successfully.`
            : `${createdFiles.length} files uploaded successfully.`,
        files: createdFiles,
      });
    } catch (err) {
      cleanupUploadedDiskFiles(uploadedFiles);
      next(err);
    }
  }
);

// GET /api/files/:id/download
router.get('/:id/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const fileId = Number(req.params.id);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new ApiError(400, 'Invalid file ID.');
    }

    const fileRecord = queryOne<DbFile>(
      `SELECT id, user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM files
       WHERE id = ? AND user_id = ?`,
      [fileId, userId]
    );

    if (!fileRecord) {
      throw new ApiError(404, 'File not found or you do not have permission to access it.');
    }

    const diskPath = resolveSafeDiskPath(String(fileRecord.stored_name));

    if (!fs.existsSync(diskPath)) {
      throw new ApiError(404, 'File content is missing from server storage.');
    }

    const isInlinePreview = req.query.inline === '1';
    const safeDownloadName = sanitizeDisplayName(String(fileRecord.display_name));
    const encodedName = encodeURIComponent(safeDownloadName);

    res.setHeader('Content-Type', String(fileRecord.mime_type) || 'application/octet-stream');
    res.setHeader('Content-Length', String(fileRecord.size_bytes));
    res.setHeader(
      'Content-Disposition',
      `${isInlinePreview ? 'inline' : 'attachment'}; filename="${safeDownloadName.replace(/"/g, '')}"; filename*=UTF-8''${encodedName}`
    );

    const stream = fs.createReadStream(diskPath);
    stream.on('error', (streamErr) => {
      next(streamErr);
    });
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// PUT /api/files/:id (Rename file display_name without changing stored_name)
router.put('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const fileId = Number(req.params.id);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new ApiError(400, 'Invalid file ID.');
    }

    const { display_name } = req.body ?? {};
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      throw new ApiError(400, 'New file name cannot be empty.');
    }

    const existing = queryOne<DbFile>(
      `SELECT id, user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM files
       WHERE id = ? AND user_id = ?`,
      [fileId, userId]
    );

    if (!existing) {
      throw new ApiError(404, 'File not found or you do not have permission to rename it.');
    }

    const sanitizedNewName = sanitizeDisplayName(display_name);
    const check = isAllowedFile(sanitizedNewName, String(existing.mime_type));
    if (!check.valid) {
      throw new ApiError(400, check.reason || 'New file name has an unsupported extension.');
    }

    runStatement(
      'UPDATE files SET display_name = ? WHERE id = ? AND user_id = ?',
      [sanitizedNewName, fileId, userId]
    );

    const updatedFile = {
      id: Number(existing.id),
      user_id: Number(existing.user_id),
      display_name: sanitizedNewName,
      stored_name: String(existing.stored_name),
      mime_type: String(existing.mime_type),
      size_bytes: Number(existing.size_bytes),
      uploaded_at: String(existing.uploaded_at),
    };

    res.json({
      message: `File renamed to "${sanitizedNewName}".`,
      file: updatedFile,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/files/:id (Delete from both SQLite database and server disk)
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const fileId = Number(req.params.id);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new ApiError(400, 'Invalid file ID.');
    }

    const existing = queryOne<DbFile>(
      `SELECT id, user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at
       FROM files
       WHERE id = ? AND user_id = ?`,
      [fileId, userId]
    );

    if (!existing) {
      throw new ApiError(404, 'File not found or you do not have permission to delete it.');
    }

    // Delete from SQLite database first
    runStatement('DELETE FROM files WHERE id = ? AND user_id = ?', [fileId, userId]);

    // Delete physical file from server disk
    try {
      const diskPath = resolveSafeDiskPath(String(existing.stored_name));
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    } catch (unlinkErr) {
      console.error('Warning: Failed to remove file from disk:', unlinkErr);
    }

    res.json({
      message: `"${existing.display_name}" was permanently deleted.`,
      deletedId: fileId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
