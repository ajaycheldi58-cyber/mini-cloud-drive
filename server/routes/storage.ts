import { Router, Request, Response, NextFunction } from 'express';
import { queryAll, DbFile } from '../db.ts';
import { requireAuth } from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth);

// GET /api/storage
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const files = queryAll<DbFile>(
      'SELECT mime_type, size_bytes FROM files WHERE user_id = ?',
      [user.id]
    );

    let usedBytes = 0;
    let imagesBytes = 0;
    let documentsBytes = 0;
    let mediaBytes = 0;
    let otherBytes = 0;

    for (const file of files) {
      const size = Number(file.size_bytes) || 0;
      const mime = String(file.mime_type || '').toLowerCase();
      usedBytes += size;

      if (mime.startsWith('image/')) {
        imagesBytes += size;
      } else if (
        mime.includes('pdf') ||
        mime.startsWith('text/') ||
        mime.includes('word') ||
        mime.includes('spreadsheet') ||
        mime.includes('presentation') ||
        mime.includes('json') ||
        mime.includes('csv')
      ) {
        documentsBytes += size;
      } else if (mime.startsWith('video/') || mime.startsWith('audio/')) {
        mediaBytes += size;
      } else {
        otherBytes += size;
      }
    }

    const quotaBytes = Number(user.quota_bytes);
    const remainingBytes = Math.max(0, quotaBytes - usedBytes);
    const percentageUsed = quotaBytes > 0 ? Math.min(100, Number(((usedBytes / quotaBytes) * 100).toFixed(2))) : 0;

    res.json({
      used_bytes: usedBytes,
      quota_bytes: quotaBytes,
      remaining_bytes: remainingBytes,
      total_files: files.length,
      percentage_used: percentageUsed,
      breakdown: {
        images_bytes: imagesBytes,
        documents_bytes: documentsBytes,
        media_bytes: mediaBytes,
        other_bytes: otherBytes,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
