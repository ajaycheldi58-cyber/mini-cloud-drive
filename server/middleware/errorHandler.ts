import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'File exceeds the maximum allowed upload size (100 MB).',
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Too many files uploaded at once (maximum 20 files per batch).',
      });
      return;
    }
    res.status(400).json({ error: `Upload error: ${err.message}` });
    return;
  }

  if (err instanceof Error) {
    console.error('[Server Error]:', err.message);
    res.status(500).json({
      error: err.message || 'An unexpected server error occurred.',
    });
    return;
  }

  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
}
