# Mini Cloud Drive

A personal cloud storage web application built with **React**, **Node.js**, **Express**, **SQLite**, **Multer**, **JWT**, and **bcrypt**. Users can register, log in, upload single or multiple files via drag-and-drop or file picker, preview supported files in-browser, download files, rename display filenames without altering safe internal disk names, delete files from both SQLite and disk, and track their 100 MB storage quota.

---

## Project Structure

```text
├── server.ts                         # Express + Vite server entry point (Port 3000)
├── server/
│   ├── config.ts                     # Server configuration, quota constants & file type validation
│   ├── db.ts                         # SQLite database initialization & persistence (users & files tables)
│   ├── middleware/
│   │   ├── auth.ts                   # JWT authentication middleware (requireAuth)
│   │   └── errorHandler.ts           # Centralized Express error-handling middleware
│   └── routes/
│       ├── auth.ts                   # POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
│       ├── files.ts                  # GET/POST /api/files, GET /api/files/:id/download, PUT/DELETE /api/files/:id
│       └── storage.ts                # GET /api/storage
├── src/
│   ├── App.tsx                       # Main React application (Dashboard, My Files, Upload, Search, Sort)
│   ├── types.ts                      # Frontend TypeScript interfaces
│   ├── utils/
│   │   └── format.ts                 # Byte formatting, date formatting, and file category helpers
│   └── components/
│       ├── AuthView.tsx              # Login and Register pages
│       ├── FileTypeIcon.tsx          # File-type badge icons
│       ├── FilePreviewModal.tsx      # In-browser preview modal (Images, CSV, Markdown/Text, PDF, Audio/Video)
│       ├── RenameModal.tsx           # Safe file rename modal
│       └── DeleteModal.tsx           # Permanent deletion confirmation modal
├── data/
│   └── minidrive.sqlite              # Persistent SQLite database file (auto-created on startup)
└── uploads/                          # Local disk directory for uploaded user files (auto-created on startup)
```

---

## Database Schema (SQLite)

### `users` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Unique user ID |
| `name` | `TEXT NOT NULL` | Full name |
| `email` | `TEXT NOT NULL UNIQUE` | User email address |
| `passwordHash` | `TEXT NOT NULL` | Bcrypt password hash |
| `quota_bytes` | `INTEGER NOT NULL DEFAULT 104857600` | Per-user storage quota (100 MB default) |

### `files` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Unique file ID |
| `user_id` | `INTEGER NOT NULL` | Owner user ID (`FOREIGN KEY REFERENCES users(id)`) |
| `display_name` | `TEXT NOT NULL` | User-visible file name |
| `stored_name` | `TEXT NOT NULL UNIQUE` | Randomized UUID filename stored on disk |
| `mime_type` | `TEXT NOT NULL` | MIME type of the file |
| `size_bytes` | `INTEGER NOT NULL` | File size in bytes |
| `uploaded_at` | `TEXT NOT NULL` | ISO-8601 upload timestamp |

---

## REST API Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register a new account with 100 MB storage quota |
| `POST` | `/api/auth/login` | Public | Authenticate with email & password and receive a JWT |
| `GET` | `/api/auth/me` | Bearer JWT | Fetch current authenticated user profile |
| `GET` | `/api/files` | Bearer JWT | List user's files with optional `search`, `sortBy`, and `sortOrder` |
| `POST` | `/api/files` | Bearer JWT | Upload one or multiple files (`multipart/form-data`) with quota check |
| `GET` | `/api/files/:id/download` | Bearer JWT | Download or inline-preview (`?inline=1`) a user's file |
| `PUT` | `/api/files/:id` | Bearer JWT | Rename `display_name` without altering `stored_name` on disk |
| `DELETE` | `/api/files/:id` | Bearer JWT | Delete file record from SQLite and remove file from server disk |
| `GET` | `/api/storage` | Bearer JWT | Retrieve used bytes, remaining bytes, total files, and category breakdown |

---

## Local Setup & Installation Instructions

### 1. Prerequisites
- **Node.js** v18+ (or v20+ recommended)
- **npm** v9+

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env` and customize if desired:
```bash
cp .env.example .env
```

Available environment variables in `.env`:
```env
PORT=3000
JWT_SECRET="replace-with-a-strong-random-jwt-secret-key"
DEFAULT_QUOTA_BYTES=104857600
MAX_FILE_SIZE_BYTES=52428800
STORAGE_DIR="./uploads"
DB_FILE="./data/minidrive.sqlite"
```

### 4. Start the Application (Development)
Runs both the Express backend API and the Vite React frontend on `http://localhost:3000`:
```bash
npm run dev
```

### 5. Build and Run for Production
```bash
npm run build
NODE_ENV=production npm start
```

### Demo Credentials
A pre-populated demo account is automatically seeded on first startup:
- **Email:** `alex@miniclouddrive.com`
- **Password:** `Password123!`
