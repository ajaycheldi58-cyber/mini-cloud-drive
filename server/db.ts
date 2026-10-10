import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import initSqlJs, { Database } from 'sql.js';
import { DB_FILE, DEFAULT_QUOTA_BYTES, UPLOADS_DIR } from './config.ts';

export interface DbUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  quota_bytes: number;
}

export interface DbFile {
  id: number;
  user_id: number;
  display_name: string;
  stored_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

let dbInstance: Database | null = null;

export function saveDatabase(): void {
  if (!dbInstance) return;
  const data = dbInstance.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_FILE, buffer);
}

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys and create required tables
  dbInstance.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      quota_bytes INTEGER NOT NULL DEFAULT ${DEFAULT_QUOTA_BYTES}
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      display_name TEXT NOT NULL,
      stored_name TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
  `);

  await seedDemoAccountIfNeeded(dbInstance);
  saveDatabase();

  return dbInstance;
}

async function seedDemoAccountIfNeeded(db: Database): Promise<void> {
  const demoEmail = 'alex@miniclouddrive.com';
  const stmt = db.prepare('SELECT id FROM users WHERE email = ?');
  stmt.bind([demoEmail]);
  const exists = stmt.step();
  stmt.free();

  if (exists) return;

  const passwordHash = await bcrypt.hash('Password123!', 10);
  db.run(
    'INSERT INTO users (name, email, passwordHash, quota_bytes) VALUES (?, ?, ?, ?)',
    ['Alex Rivera', demoEmail, passwordHash, DEFAULT_QUOTA_BYTES]
  );

  const userStmt = db.prepare('SELECT id FROM users WHERE email = ?');
  userStmt.bind([demoEmail]);
  userStmt.step();
  const row = userStmt.getAsObject() as { id: number };
  userStmt.free();

  const userId = row.id;

  const sampleFiles = [
    {
      display_name: 'Cloud-Architecture-Overview.md',
      mime_type: 'text/markdown',
      uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      content: `# Mini Cloud Drive — Architecture Notes\n\n## Storage Specification\n- Default per-user quota: 100 MB (104,857,600 bytes)\n- Isolated per-user file access verified by JWT middleware\n- Randomized UUID disk filenames prevent path traversal\n\n## Key Endpoints\n- \`POST /api/auth/register\`\n- \`POST /api/auth/login\`\n- \`GET /api/files\`\n- \`POST /api/files\`\n- \`GET /api/files/:id/download\`\n- \`PUT /api/files/:id\`\n- \`DELETE /api/files/:id\`\n- \`GET /api/storage\`\n`,
    },
    {
      display_name: 'Q3-Infrastructure-Costs.csv',
      mime_type: 'text/csv',
      uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
      content: `Service,Region,Tier,Monthly_Cost_USD,Status\nObject Storage,us-east-1,Standard,42.50,Active\nCompute Node,us-east-1,t3.medium,34.20,Active\nSQLite Volume,us-east-1,SSD-Gp3,12.00,Active\nCDN Edge,global,Enterprise,18.90,Active\nBackups,us-west-2,Glacier,6.40,Active\n`,
    },
    {
      display_name: 'Storage-Network-Diagram.svg',
      mime_type: 'image/svg+xml',
      uploaded_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320" width="640" height="320">
  <rect width="640" height="320" rx="16" fill="#f8fafc"/>
  <rect x="36" y="100" width="150" height="120" rx="12" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/>
  <text x="111" y="152" font-family="sans-serif" font-size="15" font-weight="bold" fill="#1e3a8a" text-anchor="middle">React Client</text>
  <text x="111" y="176" font-family="sans-serif" font-size="12" fill="#3b82f6" text-anchor="middle">JWT Auth + Fetch</text>
  <line x1="186" y1="160" x2="246" y2="160" stroke="#64748b" stroke-width="2" stroke-dasharray="4 4"/>
  <rect x="246" y="100" width="150" height="120" rx="12" fill="#f5f3ff" stroke="#7c3aed" stroke-width="2"/>
  <text x="321" y="152" font-family="sans-serif" font-size="15" font-weight="bold" fill="#4c1d95" text-anchor="middle">Express API</text>
  <text x="321" y="176" font-family="sans-serif" font-size="12" fill="#7c3aed" text-anchor="middle">Multer + Quota Guard</text>
  <line x1="396" y1="160" x2="456" y2="160" stroke="#64748b" stroke-width="2" stroke-dasharray="4 4"/>
  <rect x="456" y="100" width="150" height="120" rx="12" fill="#f0fdf4" stroke="#16a34a" stroke-width="2"/>
  <text x="531" y="152" font-family="sans-serif" font-size="15" font-weight="bold" fill="#14532d" text-anchor="middle">SQLite + Disk</text>
  <text x="531" y="176" font-family="sans-serif" font-size="12" fill="#15803d" text-anchor="middle">Local File Store</text>
</svg>`,
    },
    {
      display_name: 'workspace-settings.json',
      mime_type: 'application/json',
      uploaded_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      content: JSON.stringify(
        {
          application: 'Mini Cloud Drive',
          version: '1.0.0',
          storageQuotaMB: 100,
          encryption: 'bcrypt + JWT HS256',
          features: ['multi-upload', 'drag-and-drop', 'live-preview', 'safe-rename', 'quota-enforcement'],
        },
        null,
        2
      ),
    },
  ];

  for (const sample of sampleFiles) {
    const ext = path.extname(sample.display_name);
    const storedName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, storedName);
    const buffer = Buffer.from(sample.content, 'utf-8');
    fs.writeFileSync(filePath, buffer);

    db.run(
      `INSERT INTO files (user_id, display_name, stored_name, mime_type, size_bytes, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, sample.display_name, storedName, sample.mime_type, buffer.byteLength, sample.uploaded_at]
    );
  }
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('Database has not been initialized yet.');
  }
  return dbInstance;
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runStatement(sql: string, params: (string | number | null)[] = []): { lastInsertId: number } {
  const db = getDb();
  db.run(sql, params);
  const idRow = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  saveDatabase();
  return { lastInsertId: idRow ? Number(idRow.id) : 0 };
}
