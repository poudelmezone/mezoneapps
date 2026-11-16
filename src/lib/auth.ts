import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { now, one, run } from './db';

export const SESSION_COOKIE = 'mezoneapps_sid';
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

export async function findUserByUsername(username: string) {
  return one<{ id: string; username: string; password_hash: string }>(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username],
  );
}

export async function createUser(username: string, password: string): Promise<string> {
  const id = randomBytes(16).toString('hex');
  await run('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)', [
    id,
    username,
    hashPassword(password),
    now(),
  ]);
  return id;
}

/**
 * Serverless bootstrap: on Vercel there is no shell to run
 * `npm run admin:create`, so the first account is created from the environment
 * the first time the app touches auth — and only while no user exists.
 */
let bootstrap: Promise<void> | null = null;

export function ensureBootstrapAdmin(): Promise<void> {
  if (!bootstrap) {
    bootstrap = (async () => {
      const username = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
      const password = process.env.ADMIN_PASSWORD || '';
      if (!username || password.length < 10) return;

      const count = await one<{ n: number }>('SELECT COUNT(*) AS n FROM users');
      if (Number(count?.n ?? 0) > 0) return;

      try {
        await createUser(username, password);
      } catch (error) {
        // Another instance created it first (serverless cold starts race).
        const again = await one<{ n: number }>('SELECT COUNT(*) AS n FROM users');
        if (Number(again?.n ?? 0) === 0) throw error;
      }
    })().catch((error) => {
      console.error('[auth] bootstrap failed', error);
    });
  }
  return bootstrap;
}

export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await one<{
    id: string;
    csrf_token: string;
    expires_at: number;
    user_id: string;
    username: string;
  }>(
    `SELECT s.id, s.csrf_token, s.expires_at, u.id AS user_id, u.username
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
    [token],
  );

  if (!row) return null;

  if (Number(row.expires_at) <= now()) {
    await run('DELETE FROM sessions WHERE id = ?', [row.id]);
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    csrfToken: row.csrf_token,
    expiresAt: Number(row.expires_at),
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

  await run(
    'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
    [token, userId, csrfToken, expiresAt, now(), userAgent ? userAgent.slice(0, 300) : null],
  );

  await run('DELETE FROM sessions WHERE expires_at <= ?', [now()]);

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  const user = await one<{ username: string }>('SELECT username FROM users WHERE id = ?', [userId]);

  return { id: token, userId, username: user?.username ?? 'admin', csrfToken, expiresAt };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await run('DELETE FROM sessions WHERE id = ?', [token]);
  store.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0, sameSite: 'lax' });
}

/** Server-component guard used by the admin layout. */
export async function requireAdmin(): Promise<AdminSession> {
  await ensureBootstrapAdmin();
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
