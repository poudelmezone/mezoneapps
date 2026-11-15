#!/usr/bin/env node
/**
 * Creates (or resets) an admin account.
 *
 *   npm run admin:create               # reads ADMIN_USERNAME / ADMIN_PASSWORD from .env
 *   ADMIN_USERNAME=bob ADMIN_PASSWORD=... npm run admin:create
 *
 * The password is hashed with bcrypt (cost 12) before it ever reaches the DB.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

// Load .env without extra dependencies (Node >= 20.12).
try {
  process.loadEnvFile?.('.env');
} catch {
  /* no .env — rely on the real environment */
}

const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!username || !password) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD (in .env or the environment) first.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Refusing: choose a password with at least 10 characters.');
  process.exit(1);
}

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'storage'));
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.resolve(process.env.DATABASE_PATH || path.join(dataDir, 'app.db')));
db.pragma('journal_mode = WAL');
db.exec(fs.readFileSync(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));

const hash = bcrypt.hashSync(password, 12);
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
  console.log(`Admin "${username}" password reset. Existing sessions were revoked.`);
} else {
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    randomBytes(16).toString('hex'),
    username,
    hash,
    Date.now(),
  );
  console.log(`Admin "${username}" created.`);
}

db.close();
