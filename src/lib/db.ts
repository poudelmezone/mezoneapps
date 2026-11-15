import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'storage'));

export const APK_DIR = path.join(DATA_DIR, 'apks');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');

for (const dir of [DATA_DIR, APK_DIR, MEDIA_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

function openDatabase(): Database.Database {
  const file = path.resolve(process.env.DATABASE_PATH || path.join(DATA_DIR, 'app.db'));
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const database = new Database(file);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');

  const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
  database.exec(fs.readFileSync(schemaPath, 'utf8'));

  return database;
}

// Next.js hot-reloads modules in development; keep one connection per process.
const globalForDb = globalThis as unknown as { __apkforgeDb?: Database.Database };

export const db: Database.Database = globalForDb.__apkforgeDb ?? openDatabase();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__apkforgeDb = db;
}

export const now = () => Date.now();
