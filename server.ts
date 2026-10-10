import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { PORT } from './server/config.ts';
import { initDatabase } from './server/db.ts';
import authRoutes from './server/routes/auth.ts';
import fileRoutes from './server/routes/files.ts';
import storageRoutes from './server/routes/storage.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';

async function startServer() {
  await initDatabase();

  const app = express();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // REST API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/storage', storageRoutes);

  // Unknown API route handler
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Express error-handling middleware
  app.use(errorHandler);

  // Vite middleware for development, or static dist serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mini Cloud Drive server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Mini Cloud Drive server:', err);
  process.exit(1);
});
