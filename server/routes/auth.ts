import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, runStatement, DbUser } from '../db.ts';
import { DEFAULT_QUOTA_BYTES } from '../config.ts';
import { signUserToken, requireAuth } from '../middleware/auth.ts';
import { ApiError } from '../middleware/errorHandler.ts';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body ?? {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new ApiError(400, 'Please enter your full name (at least 2 characters).');
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      throw new ApiError(400, 'Please provide a valid email address.');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new ApiError(400, 'Password must be at least 6 characters long.');
    }

    const cleanName = name.trim().slice(0, 100);
    const cleanEmail = email.trim().toLowerCase();

    const existingUser = queryOne<DbUser>(
      'SELECT id FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (existingUser) {
      throw new ApiError(409, 'An account with this email address already exists.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { lastInsertId } = runStatement(
      'INSERT INTO users (name, email, passwordHash, quota_bytes) VALUES (?, ?, ?, ?)',
      [cleanName, cleanEmail, passwordHash, DEFAULT_QUOTA_BYTES]
    );

    const newUser = {
      id: lastInsertId,
      name: cleanName,
      email: cleanEmail,
      quota_bytes: DEFAULT_QUOTA_BYTES,
    };

    const token = signUserToken(newUser);

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: newUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body ?? {};

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new ApiError(400, 'Email and password are required.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = queryOne<DbUser>(
      'SELECT id, name, email, passwordHash, quota_bytes FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );

    if (!user) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const passwordValid = await bcrypt.compare(password, String(user.passwordHash));
    if (!passwordValid) {
      throw new ApiError(401, 'Invalid email or password.');
    }

    const authUser = {
      id: Number(user.id),
      name: String(user.name),
      email: String(user.email),
      quota_bytes: Number(user.quota_bytes),
    };

    const token = signUserToken(authUser);

    res.json({
      message: 'Logged in successfully.',
      token,
      user: authUser,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

export default router;
