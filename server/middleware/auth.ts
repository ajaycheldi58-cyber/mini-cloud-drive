import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.ts';
import { queryOne, DbUser } from '../db.ts';

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  quota_bytes: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function signUserToken(user: AuthenticatedUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token) {
      res.status(401).json({
        error: 'Authentication required. Please log in to access this resource.',
      });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as unknown as { sub: number };
    const userId = Number(decoded.sub);

    const user = queryOne<DbUser>(
      'SELECT id, name, email, quota_bytes FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(401).json({
        error: 'User account not found or session expired. Please log in again.',
      });
      return;
    }

    req.user = {
      id: Number(user.id),
      name: String(user.name),
      email: String(user.email),
      quota_bytes: Number(user.quota_bytes),
    };

    next();
  } catch {
    res.status(401).json({
      error: 'Invalid or expired authentication token. Please log in again.',
    });
  }
}
