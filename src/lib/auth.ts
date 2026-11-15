import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db, now } from './db';

export const SESSION_COOKIE = 'apkforge_sid';
export const CSRF_HEADER = 'x-csrf-token';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const BCRYPT_ROUNDS = 12;

export type AdminSession = {
  id: string;
  userId: string;
  username: string;
  csrfToken: string;
  expiresAt: number;
};

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

export function findUserByUsername(username: string) {
  return db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(username) as
    | { id: string; username: string; password_hash: string }
    | undefined;
}

export function createUser(username: string, password: string): string {
  const id = randomBytes(16).toString('hex');
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    username,
    hashPassword(password),
    now(),
  );
  return id;
}

export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = db
    .prepare(
      `SELECT s.id, s.csrf_token, s.expires_at, u.id AS user_id, u.username
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`,
    )
    .get(token) as
    | { id: string; csrf_token: string; expires_at: number; user_id: string; username: string }
    | undefined;

  if (!row) return null;

  if (row.expires_at <= now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at,
  };
}

/**
 * Creates a server-side session and sets the httpOnly cookie.
 * The CSRF token is bound to the session, so it dies with the login.
 */
export async function createSession(userId: string, userAgent: string | null): Promise<AdminSession> {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = now() + SESSION_TTL_MS;

  db.prepare(
    'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(token, userId, csrfToken, expiresAt, now(), userAgent ? userAgent.slice(0, 300) : null);

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string };

  return { id: token, userId, username: user.username, csrfToken, expiresAt };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(token);
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' });
}

/** Server-component guard used by the admin layout. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) redirect('/admin/login');
  return session;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Double-submit + session-bound CSRF check for every mutating admin request. */
export function verifyCsrf(req: Request, session: AdminSession): boolean {
  const token = req.headers.get(CSRF_HEADER);
  if (!token || !session.csrfToken) return false;
  return safeEqual(token, session.csrfToken);
}

/**
 * Rejects cross-site requests. Browsers always send Origin on fetch/POST; when it
 * is present it must match the Host we were reached on.
 */
export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = req.headers.get('host');
    return Boolean(host) && url.host === host;
  } catch {
    return false;
  }
}
